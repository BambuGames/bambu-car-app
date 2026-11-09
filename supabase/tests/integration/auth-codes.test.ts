// Invites and password resets work with the 6-digit code from the email, no links needed.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { anonClient, clearMail, latestCode, serviceClient } from './helpers.ts'

test('invite code from the email lets the user set a password and sign in', async () => {
  const email = `invited-${Date.now()}@bambu.test`
  const admin = serviceClient()
  assert.equal((await admin.auth.admin.inviteUserByEmail(email)).error, null)
  const code = await latestCode(email)

  const user = anonClient()
  const verified = await user.auth.verifyOtp({ email, token: code, type: 'invite' })
  assert.equal(verified.error, null)
  assert.ok(verified.data.session)
  assert.equal((await user.auth.updateUser({ password: 'new-password-1' })).error, null)

  const signIn = await anonClient().auth.signInWithPassword({ email, password: 'new-password-1' })
  assert.equal(signIn.error, null)

  await admin.auth.admin.deleteUser(verified.data.user!.id)
})

test('recovery code from the email sets a new password', async () => {
  const email = 'staff@bambu.test'
  await clearMail(email)
  const user = anonClient()
  assert.equal((await user.auth.resetPasswordForEmail(email)).error, null)
  const code = await latestCode(email)

  assert.equal((await user.auth.verifyOtp({ email, token: code, type: 'recovery' })).error, null)
  assert.equal((await user.auth.updateUser({ password: 'dev-password-2' })).error, null)

  const signIn = await anonClient().auth.signInWithPassword({ email, password: 'dev-password-2' })
  assert.equal(signIn.error, null)

  // Put the seeded password back for the other tests and for manual testing.
  await serviceClient().auth.admin.updateUserById(signIn.data.user!.id, { password: 'dev-password-1' })
})
