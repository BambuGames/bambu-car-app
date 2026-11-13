// gallery-members (design 9): the owner lists, invites and removes staff. A new address gets the invite mail
// with the 6-digit code (M1a); an existing account is added without a mail. Removing never deletes an account.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { anonClient, clearMail, env, latestCode, serviceClient } from './helpers.ts'

const TESTGALERIE = 'e0000000-0000-0000-0000-000000000001'
const ANDERE = 'e0000000-0000-0000-0000-000000000002'
const mailUrl = () => process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

async function token(email: string): Promise<string> {
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password: 'dev-password-1' })
  assert.equal(error, null)
  return data.session!.access_token
}

async function call(method: 'GET' | 'POST' | 'DELETE', as: string, body?: Record<string, string>) {
  const query = method === 'GET' ? `?galleryId=${body!.galleryId}` : ''
  const res = await fetch(`${env().url}/functions/v1/gallery-members${query}`, {
    method,
    headers: { Authorization: `Bearer ${await token(as)}`, 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

async function account(email: string): Promise<string> {
  const { data, error } = await serviceClient().auth.admin.createUser({ email, password: 'dev-password-1', email_confirm: true })
  assert.equal(error, null)
  return data.user!.id
}

const role = async (gallery: string, userId: string) =>
  (await serviceClient().from('gallery_members').select('role').eq('gallery_id', gallery).eq('user_id', userId).maybeSingle()).data?.role ?? null

test('the owner invites a new person, who gets the code mail and becomes staff', async () => {
  const email = `neu-${Date.now()}@bambu.test`
  const res = await call('POST', 'owner@bambu.test', { galleryId: TESTGALERIE, email })
  assert.equal(res.status, 201)
  assert.equal(res.body.invited, true)
  assert.match(await latestCode(email), /^\d{6}$/)
  assert.equal(await role(TESTGALERIE, res.body.userId), 'staff')

  const list = await call('GET', 'owner@bambu.test', { galleryId: TESTGALERIE })
  assert.equal(list.status, 200)
  const row = list.body.members.find((m: { userId: string }) => m.userId === res.body.userId)
  assert.deepEqual({ email: row.email, role: row.role, confirmed: row.confirmed }, { email, role: 'staff', confirmed: false })
  assert.ok(list.body.members.some((m: { email: string; role: string; confirmed: boolean }) => m.email === 'owner@bambu.test' && m.role === 'owner' && m.confirmed))

  await serviceClient().auth.admin.deleteUser(res.body.userId)
})

test('inviting an existing account adds it without a mail', async () => {
  const email = `vorhanden-${Date.now()}@bambu.test`
  const userId = await account(email)
  await clearMail(email)
  const res = await call('POST', 'owner@bambu.test', { galleryId: TESTGALERIE, email: ` ${email.toUpperCase()} ` })
  assert.equal(res.status, 201)
  assert.deepEqual(res.body, { userId, invited: false })
  assert.equal(await role(TESTGALERIE, userId), 'staff')
  await new Promise((resolve) => setTimeout(resolve, 1000))
  const { messages = [] } = await (await fetch(`${mailUrl()}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json()
  assert.equal(messages.length, 0)

  const again = await call('POST', 'owner@bambu.test', { galleryId: TESTGALERIE, email })
  assert.deepEqual(again, { status: 409, body: { error: 'already_member' } })
  await serviceClient().auth.admin.deleteUser(userId)
})

test('an account of another gallery is not moved over', async () => {
  const res = await call('POST', 'owner@bambu.test', { galleryId: TESTGALERIE, email: 'other@bambu.test' })
  assert.deepEqual(res, { status: 409, body: { error: 'member_elsewhere' } })
  assert.equal((await call('POST', 'owner@bambu.test', { galleryId: TESTGALERIE, email: 'kein-at-zeichen' })).status, 400)
})

test('staff cannot invite or remove members', async () => {
  const forbidden = { status: 403, body: { error: 'not_owner' } }
  assert.deepEqual(await call('GET', 'staff@bambu.test', { galleryId: TESTGALERIE }), forbidden)
  assert.deepEqual(await call('POST', 'staff@bambu.test', { galleryId: TESTGALERIE, email: `x-${Date.now()}@bambu.test` }), forbidden)
  const staffId = (await anonClient().auth.signInWithPassword({ email: 'staff@bambu.test', password: 'dev-password-1' })).data.user!.id
  assert.deepEqual(await call('DELETE', 'staff@bambu.test', { galleryId: TESTGALERIE, userId: staffId }), forbidden)
  // The owner of one gallery is no one in another.
  assert.deepEqual(await call('GET', 'owner@bambu.test', { galleryId: ANDERE }), forbidden)
})

test('an owner cannot remove themselves or another owner', async () => {
  const ownerId = (await anonClient().auth.signInWithPassword({ email: 'owner@bambu.test', password: 'dev-password-1' })).data.user!.id
  assert.deepEqual(await call('DELETE', 'owner@bambu.test', { galleryId: TESTGALERIE, userId: ownerId }), {
    status: 400,
    body: { error: 'cannot_remove_self' },
  })
  const secondOwner = await account(`zweiter-inhaber-${Date.now()}@bambu.test`)
  assert.equal((await serviceClient().from('gallery_members').insert({ gallery_id: TESTGALERIE, user_id: secondOwner, role: 'owner' })).error, null)
  assert.deepEqual(await call('DELETE', 'owner@bambu.test', { galleryId: TESTGALERIE, userId: secondOwner }), {
    status: 400,
    body: { error: 'cannot_remove_owner' },
  })
  await serviceClient().auth.admin.deleteUser(secondOwner)
})

test('the owner removes staff; the account stays', async () => {
  const userId = await account(`weg-${Date.now()}@bambu.test`)
  assert.equal((await serviceClient().from('gallery_members').insert({ gallery_id: TESTGALERIE, user_id: userId, role: 'staff' })).error, null)
  const res = await call('DELETE', 'owner@bambu.test', { galleryId: TESTGALERIE, userId })
  assert.deepEqual(res, { status: 200, body: { removed: true } })
  assert.equal(await role(TESTGALERIE, userId), null)
  assert.equal((await serviceClient().auth.admin.getUserById(userId)).data.user?.id, userId)
  await serviceClient().auth.admin.deleteUser(userId)
})

test('re-inviting someone who never accepted sends the code mail again', async () => {
  const email = `nochmal-${Date.now()}@bambu.test`
  const first = await call('POST', 'owner@bambu.test', { galleryId: TESTGALERIE, email })
  assert.equal(first.status, 201)
  assert.equal((await call('DELETE', 'owner@bambu.test', { galleryId: TESTGALERIE, userId: first.body.userId })).status, 200)
  await clearMail(email)

  const again = await call('POST', 'owner@bambu.test', { galleryId: TESTGALERIE, email })
  assert.deepEqual(again, { status: 201, body: { userId: first.body.userId, invited: true } })
  assert.match(await latestCode(email), /^\d{6}$/)
  await serviceClient().auth.admin.deleteUser(first.body.userId)
})
