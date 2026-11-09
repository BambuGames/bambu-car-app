// Deletes the signed-in user's account; Apple and the GDPR require deletion inside the app.
// Gallery memberships go with the user (cascade); the gallery's vehicles stay with the gallery.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'unauthorized' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return json(401, { error: 'unauthorized' })

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id)
  if (deleteError) return json(500, { error: 'delete_failed' })
  return json(200, { deleted: true })
})
