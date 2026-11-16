// Export link (spec 10): a ZIP of a vehicle's photos for a computer, valid for 7 days. Any member of the
// vehicle's gallery may ask; the image worker builds the ZIP from the photos the app chose, in its order.
//   POST { vehicleId, version: 'watermarked' | 'plain' | 'originals', photoIds } → 200 { url, expiresAt, count }
// Errors: 400 bad_request, 401 unauthorized, 403 not_member, 409 nothing_to_export, 502 worker_unreachable.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const noSession = { persistSession: false, autoRefreshToken: false }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VERSIONS = ['watermarked', 'plain', 'originals']
const MAX_PHOTOS = 40 // the per-vehicle cap (design 9)
const SEVEN_DAYS = 7 * 24 * 3600
const WORKER_TIMEOUT_MS = 120_000 // a cold Cloud Run start plus a set of originals

// "Škoda", "Octavia" → "Skoda-Octavia.zip": a file name every computer accepts.
const zipName = (make: string, model: string) =>
  `${`${make}-${model}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'Fahrzeug'}.zip`

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json(401, { error: 'unauthorized' })

  const body = await req.json().catch(() => null)
  const { vehicleId, version, photoIds } = body ?? {}
  if (
    typeof vehicleId !== 'string' || !UUID.test(vehicleId) ||
    !VERSIONS.includes(version) ||
    !Array.isArray(photoIds) || photoIds.length === 0 || photoIds.length > MAX_PHOTOS ||
    !photoIds.every((id: unknown) => typeof id === 'string' && UUID.test(id))
  ) {
    return json(400, { error: 'bad_request' })
  }

  // Read as the user: row-level security answers whether they belong to the vehicle's gallery.
  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: noSession,
    global: { headers: { Authorization: authorization } },
  })
  const { data: vehicle, error } = await user.from('vehicles').select('id, make, model').eq('id', vehicleId).maybeSingle()
  if (error?.code === 'PGRST301' || error?.message?.includes('JWT')) return json(401, { error: 'unauthorized' })
  if (error) {
    console.error('export-vehicle: reading the vehicle failed', error)
    return json(500, { error: 'internal' })
  }
  if (!vehicle) return json(403, { error: 'not_member' })

  let made: { path: string; count: number }
  try {
    const res = await fetch(`${Deno.env.get('WORKER_URL')}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-worker-secret': Deno.env.get('WORKER_SECRET') ?? '' },
      body: JSON.stringify({ vehicle_id: vehicleId, version, photo_ids: photoIds }),
      signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
    })
    if (res.status === 409) return json(409, { error: 'nothing_to_export' })
    if (!res.ok) throw new Error(`worker answered ${res.status}`)
    made = await res.json()
  } catch (e) {
    console.error('export-vehicle: worker call failed', vehicleId, String(e))
    return json(502, { error: 'worker_unreachable' })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: noSession })
  const signed = await admin.storage.from('processed').createSignedUrl(made.path, SEVEN_DAYS, {
    download: zipName(vehicle.make, vehicle.model),
  })
  if (signed.error || !signed.data) {
    console.error('export-vehicle: signing failed', signed.error)
    return json(500, { error: 'internal' })
  }
  // Locally SUPABASE_URL is the runtime's internal address; a browser needs the public one.
  const publicBase = Deno.env.get('PUBLIC_API_URL')
  const url = publicBase ? publicBase + signed.data.signedUrl.slice(new URL(signed.data.signedUrl).origin.length) : signed.data.signedUrl
  return json(200, { url, expiresAt: new Date(Date.now() + SEVEN_DAYS * 1000).toISOString(), count: made.count })
})
