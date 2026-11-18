// clean-reports: the daily cron job's function removes report files and suggestions of reads open > 7 days.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { env, serviceClient } from './helpers.ts'

const TESTGALERIE = 'e0000000-0000-0000-0000-000000000001'
const DAY = 24 * 60 * 60 * 1000
// The secret lives in the git-ignored functions .env; it is never printed.
const secret = /^CRON_SECRET=(.+)$/m.exec(readFileSync('supabase/functions/.env', 'utf8'))?.[1]

const clean = (headers: Record<string, string>) =>
  fetch(`${env().url}/functions/v1/clean-reports`, { method: 'POST', headers: { apikey: env().anonKey, ...headers } })

test('clean-reports without the secret answers 401', async () => {
  assert.equal((await clean({})).status, 401)
  assert.equal((await clean({ 'x-cron-secret': 'wrong' })).status, 401)
})

test('clean-reports removes only reads older than 7 days', async () => {
  assert.ok(secret, 'CRON_SECRET missing in supabase/functions/.env')
  const db = serviceClient()
  const vehicleId = crypto.randomUUID()
  const { error } = await db.from('vehicles').insert({
    id: vehicleId, gallery_id: TESTGALERIE, make: 'VW', model: 'Golf', body_type: 'hatchback',
  })
  assert.equal(error, null)

  const read = async (ageDays: number) => {
    const id = crypto.randomUUID()
    const path = `${TESTGALERIE}/${vehicleId}/${id}.pdf`
    const up = await db.storage.from('reports').upload(path, new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { contentType: 'application/pdf' })
    assert.equal(up.error, null)
    const ins = await db.from('report_reads').insert({
      id, gallery_id: TESTGALERIE, vehicle_id: vehicleId, files: [path], status: 'done',
      suggestions: { fields: {} }, created_at: new Date(Date.now() - ageDays * DAY).toISOString(),
    })
    assert.equal(ins.error, null)
    return { id, path }
  }
  const exists = async (path: string) => {
    const { data } = await db.storage.from('reports').list(path.slice(0, path.lastIndexOf('/')))
    return (data ?? []).some((f) => path.endsWith(`/${f.name}`))
  }

  try {
    const old = await read(8)
    const fresh = await read(1)
    const res = await clean({ 'x-cron-secret': secret! })
    assert.equal(res.status, 200)
    assert.ok((await res.json()).cleaned >= 1)

    const rows = await db.from('report_reads').select('id, suggestions, closed_at').in('id', [old.id, fresh.id])
    const byId = Object.fromEntries(rows.data!.map((r) => [r.id, r]))
    assert.equal(byId[old.id].suggestions, null)
    assert.notEqual(byId[old.id].closed_at, null)
    assert.equal(await exists(old.path), false)
    assert.notEqual(byId[fresh.id].suggestions, null)
    assert.equal(byId[fresh.id].closed_at, null)
    assert.equal(await exists(fresh.path), true)
  } finally {
    const { data } = await db.from('report_reads').select('files').eq('vehicle_id', vehicleId)
    await db.storage.from('reports').remove((data ?? []).flatMap((r) => r.files))
    await db.from('vehicles').delete().eq('id', vehicleId) // cascades or fails loudly if not
  }
})

test('clean-reports also removes old files that no read points at', async () => {
  assert.ok(secret, 'CRON_SECRET missing in supabase/functions/.env')
  const db = serviceClient()
  const folder = `${TESTGALERIE}/${crypto.randomUUID()}/${crypto.randomUUID()}` // a read that was never recorded
  const file = async (name: string) => {
    const up = await db.storage.from('reports').upload(`${folder}/${name}`, new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { contentType: 'application/pdf' })
    assert.equal(up.error, null)
  }
  const left = async () => ((await db.storage.from('reports').list(folder)).data ?? []).map((f) => f.name).sort()

  try {
    await file('old.pdf')
    await file('fresh.pdf')
    // Storage sets created_at itself; age one file by hand on the local database (folder is two UUIDs, safe to inline).
    execFileSync('npx', ['supabase', 'db', 'query',
      `update storage.objects set created_at = now() - interval '8 days' where bucket_id = 'reports' and name = '${folder}/old.pdf'`],
      { stdio: 'ignore' })
    const res = await clean({ 'x-cron-secret': secret! })
    assert.equal(res.status, 200)
    assert.deepEqual(await left(), ['fresh.pdf'])
  } finally {
    await db.storage.from('reports').remove([`${folder}/old.pdf`, `${folder}/fresh.pdf`])
  }
})
