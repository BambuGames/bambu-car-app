// Starts processing a vehicle (design 9, 11.3): start_processing charges the credit once and queues the
// photos in one transaction, as the signed-in user; the queued photos then go to the image worker. The
// answer does not wait for the worker: the app follows the photo rows live.
// Only the gallery's owner may start the first, charged processing (M5): staff get 403 not_owner; another gallery's
// vehicle stays 403 not_member.
import { createClient } from 'jsr:@supabase/supabase-js@2'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const noSession = { persistSession: false, autoRefreshToken: false }

async function handOff(vehicleId: string, photoIds: string[]): Promise<void> {
  try {
    const res = await fetch(`${Deno.env.get('WORKER_URL')}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-worker-secret': Deno.env.get('WORKER_SECRET') ?? '' },
      body: JSON.stringify({ vehicle_id: vehicleId, photo_ids: photoIds }),
    })
    if (!res.ok) throw new Error(`worker answered ${res.status}`)
  } catch (error) {
    // Not reached or refused: the photos still waiting fail now (retry is free) instead of sitting in the
    // queue for the 10 minutes after which start_processing would take them again. Photos the worker
    // already took or finished are its own.
    console.error('process-vehicle: worker call failed', vehicleId, String(error))
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: noSession })
    const failed = await admin.from('photos').update({ process_status: 'failed', process_error: 'worker_unreachable' })
      .in('id', photoIds).eq('process_status', 'queued')
    if (failed.error) console.error('process-vehicle: could not mark photos failed', failed.error)
    // Nothing left running: the vehicle must not stay "processing".
    const { count } = await admin.from('photos').select('id', { count: 'exact', head: true })
      .eq('vehicle_id', vehicleId).in('process_status', ['queued', 'processing'])
    if (count === 0) await admin.from('vehicles').update({ status: 'ready' }).eq('id', vehicleId).eq('status', 'processing')
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json(401, { error: 'unauthorized' })

  let body: { vehicleId?: unknown; photoId?: unknown; rerender?: unknown }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'bad_request' })
  }
  const { vehicleId, photoId, rerender } = body ?? {}
  if (
    typeof vehicleId !== 'string' ||
    (photoId !== undefined && typeof photoId !== 'string') ||
    (rerender !== undefined && typeof rerender !== 'boolean')
  ) {
    return json(400, { error: 'bad_request' })
  }

  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: noSession,
    global: { headers: { Authorization: authorization } },
  })
  const { data, error } = await user.rpc('start_processing', {
    p_vehicle_id: vehicleId,
    p_photo_id: photoId ?? null,
    p_rerender: rerender ?? false,
  })
  if (error) {
    if (error.message === 'not_owner') return json(403, { error: 'not_owner' }) // M5: staff cannot spend a credit
    if (error.code === '42501') return json(403, { error: 'not_member' })
    if (error.message === 'no_credit') return json(402, { error: 'no_credit' })
    if (error.message === 'photo_limit') return json(409, { error: 'photo_limit' }) // design 9: per-vehicle cap
    if (error.code === '22P02') return json(400, { error: 'bad_request' }) // not a uuid
    console.error('process-vehicle: start_processing failed', error)
    return json(500, { error: 'internal' })
  }

  const queued = (data ?? []) as string[]
  if (queued.length === 0) return json(200, { queued })
  EdgeRuntime.waitUntil(handOff(vehicleId, queued))
  return json(202, { queued })
})
