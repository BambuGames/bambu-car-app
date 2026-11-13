// Staff management (design 9), for the gallery's owner only.
//   GET    ?galleryId=            → 200 { members: { userId, email, role, invitedAt, confirmed }[] }
//   POST   { galleryId, email }   → 201 { userId, invited }: a new address, or one whose earlier invite was never
//                                  accepted, gets the invite mail with the 6-digit code (M1a); an existing account
//                                  is added without a mail. Always as staff.
//   DELETE { galleryId, userId }  → 200 { removed: true }: leaves the gallery; the account stays.
// Errors: 401 unauthorized, 403 not_owner, 400 bad_request | invalid_email | cannot_remove_self |
// cannot_remove_owner, 404 not_member, 409 already_member | member_elsewhere (the app reads one gallery per
// account, so a second membership would switch the person's gallery at random).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) return json(405, { error: 'method_not_allowed' })
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'unauthorized' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: caller, error: authError } = await admin.auth.getUser(token)
  if (authError || !caller.user) return json(401, { error: 'unauthorized' })

  const body = req.method === 'GET' ? {} : await req.json().catch(() => ({}))
  const galleryId: unknown = req.method === 'GET' ? new URL(req.url).searchParams.get('galleryId') : body.galleryId
  if (typeof galleryId !== 'string' || !UUID.test(galleryId)) return json(400, { error: 'bad_request' })

  const { data: me } = await admin.from('gallery_members').select('role').eq('gallery_id', galleryId).eq('user_id', caller.user.id).maybeSingle()
  if (me?.role !== 'owner') return json(403, { error: 'not_owner' })

  if (req.method === 'GET') {
    const { data: rows, error } = await admin.from('gallery_members').select('user_id, role').eq('gallery_id', galleryId).order('created_at')
    if (error) return json(500, { error: 'internal' })
    // ponytail: one auth lookup per member; a gallery has a handful of people.
    const list = await Promise.all(
      rows.map(async (r) => {
        const { data } = await admin.auth.admin.getUserById(r.user_id)
        const u = data.user
        return { userId: r.user_id, email: u?.email ?? null, role: r.role, invitedAt: u?.invited_at ?? null, confirmed: !!u?.email_confirmed_at }
      }),
    )
    return json(200, { members: list })
  }

  if (req.method === 'POST') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!EMAIL.test(email)) return json(400, { error: 'invalid_email' })
    const { data: existing, error: lookupError } = await admin.rpc('admin_user_id_by_email', { p_email: email })
    if (lookupError) return json(500, { error: 'internal' })

    let userId: string = existing
    // Someone who never accepted an earlier invite has no password yet: they get the code mail again.
    let invite = !existing
    if (userId) {
      const { data: other } = await admin.from('gallery_members').select('gallery_id').eq('user_id', userId)
      if (other?.some((m) => m.gallery_id === galleryId)) return json(409, { error: 'already_member' })
      if (other && other.length > 0) return json(409, { error: 'member_elsewhere' })
      const { data: found } = await admin.auth.admin.getUserById(userId)
      invite = !found.user?.email_confirmed_at
    }
    if (invite) {
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email)
      if (inviteError || !invited.user) return json(500, { error: 'invite_failed' })
      userId = invited.user.id
    }
    const { error: insertError } = await admin.from('gallery_members').insert({ gallery_id: galleryId, user_id: userId, role: 'staff' })
    if (insertError) return json(insertError.code === '23505' ? 409 : 500, { error: insertError.code === '23505' ? 'already_member' : 'internal' })
    return json(201, { userId, invited: invite })
  }

  // DELETE
  const userId: unknown = body.userId
  if (typeof userId !== 'string' || !UUID.test(userId)) return json(400, { error: 'bad_request' })
  if (userId === caller.user.id) return json(400, { error: 'cannot_remove_self' })
  const { data: target } = await admin.from('gallery_members').select('role').eq('gallery_id', galleryId).eq('user_id', userId).maybeSingle()
  if (!target) return json(404, { error: 'not_member' })
  if (target.role === 'owner') return json(400, { error: 'cannot_remove_owner' })
  const { error: deleteError } = await admin.from('gallery_members').delete().eq('gallery_id', galleryId).eq('user_id', userId)
  if (deleteError) return json(500, { error: 'internal' })
  return json(200, { removed: true })
})
