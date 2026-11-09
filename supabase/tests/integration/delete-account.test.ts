// In-app account deletion (Apple and GDPR): the user and their gallery membership are removed.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { anonClient, env, serviceClient } from './helpers.ts'

const TESTGALERIE = 'e0000000-0000-0000-0000-000000000001'
const deleteAccount = (headers: Record<string, string>) =>
  fetch(`${env().url}/functions/v1/delete-account`, { method: 'POST', headers: { apikey: env().anonKey, ...headers } })

test('deletes the calling user and their gallery membership', async () => {
  const admin = serviceClient()
  const email = `leaving-${Date.now()}@bambu.test`
  const created = await admin.auth.admin.createUser({ email, password: 'pw-12345678', email_confirm: true })
  assert.equal(created.error, null)
  const userId = created.data.user!.id
  const added = await admin.rpc('admin_add_member', { p_gallery_id: TESTGALERIE, p_email: email, p_role: 'staff' })
  assert.equal(added.error, null)

  const signIn = await anonClient().auth.signInWithPassword({ email, password: 'pw-12345678' })
  assert.equal(signIn.error, null)
  const res = await deleteAccount({ Authorization: `Bearer ${signIn.data.session!.access_token}` })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { deleted: true })

  assert.ok((await admin.auth.admin.getUserById(userId)).error, 'the user is gone')
  const members = await admin.from('gallery_members').select('user_id').eq('user_id', userId)
  assert.deepEqual(members.data, [])
})

test('rejects a request without a valid token', async () => {
  const res = await deleteAccount({ Authorization: 'Bearer not-a-valid-token' })
  assert.equal(res.status, 401)
})
