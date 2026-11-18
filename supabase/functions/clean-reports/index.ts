// Report cleanup (design 5.8): the daily pg_cron job calls this to delete the report files and empty the
// suggestions of every read that has been open for more than 7 days (any status, so stuck reads too), then to
// delete every report file older than 7 days that is still there, read row or not (an upload cut off before
// read-report recorded it, or a failed best-effort remove in the app, leaves files no row points at).
//   POST, header x-cron-secret: CRON_SECRET → 200 { cleaned, removed }
// There is no user JWT here (config.toml: verify_jwt = false); the secret is the only credential.
// Errors: 401 unauthorized, 500 internal.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const noSession = { persistSession: false, autoRefreshToken: false }

// Constant-time comparison of two strings (length itself is not secret here).
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ (y[i] ?? 0)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  const expected = Deno.env.get('CRON_SECRET')
  const given = req.headers.get('x-cron-secret')
  if (!expected || !given || !sameSecret(given, expected)) return json(401, { error: 'unauthorized' })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: noSession })
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: reads, error } = await db
    .from('report_reads').select('id, files').is('closed_at', null).lt('created_at', cutoff)
  if (error) return json(500, { error: 'internal' })

  let cleaned = 0
  for (const read of reads) {
    // A failure for one read leaves it open, so the next run retries it; the others carry on.
    const removed = await db.storage.from('reports').remove(read.files) // missing files are not an error
    if (removed.error) continue
    const { error: closeError } = await db
      .from('report_reads').update({ suggestions: null, closed_at: new Date().toISOString() }).eq('id', read.id)
    if (!closeError) cleaned++
  }

  // ponytail: one page of names (PostgREST max_rows, 1000) per run; the rest go in the next daily run.
  const { data: old, error: listError } = await db.rpc('old_report_files', { p_before: cutoff })
  if (listError) return json(500, { error: 'internal' })
  let removed = 0
  for (let i = 0; i < old.length; i += 100) {
    const batch = await db.storage.from('reports').remove(old.slice(i, i + 100).map((f: { name: string }) => f.name))
    if (!batch.error) removed += batch.data.length // a failed batch is retried by the next run
  }
  return json(200, { cleaned, removed })
})
