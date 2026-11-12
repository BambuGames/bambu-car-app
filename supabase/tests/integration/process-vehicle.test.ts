// process-vehicle (design 9, 11.3): charges a vehicle once, queues its photos and hands them to the image
// worker. A fake worker listens on the local worker port (8090; stop the real worker before these tests).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { after, before, test } from 'node:test'

import { anonClient, env, serviceClient } from './helpers.ts'

const TESTGALERIE = 'e0000000-0000-0000-0000-000000000001'
const ANDERE = 'e0000000-0000-0000-0000-000000000002'
const SECRET = /^WORKER_SECRET=(.*)$/m.exec(readFileSync(new URL('../../functions/.env', import.meta.url), 'utf8'))![1]

type Received = { body: { vehicle_id: string; photo_ids: string[] }; secret: string | undefined }
const received: Received[] = []
let worker: Server
// 'error': the worker finishes the first photo, then answers 500 (as if it failed half-way).
let workerMode: 'ok' | 'error' = 'ok'

function startWorker(): Promise<void> {
  worker = createServer((req: IncomingMessage, res) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', async () => {
      const body = JSON.parse(data)
      received.push({ body, secret: req.headers['x-worker-secret'] as string | undefined })
      if (workerMode === 'error') {
        await serviceClient().from('photos').update({ process_status: 'done' }).eq('id', body.photo_ids[0])
        res.writeHead(500).end()
        return
      }
      res.writeHead(202, { 'Content-Type': 'application/json' }).end(`{"accepted":${body.photo_ids.length}}`)
    })
  })
  return new Promise((resolve) => worker.listen(8090, '127.0.0.1', resolve))
}
before(startWorker)
after(() => worker?.close())

async function signIn(email: string): Promise<string> {
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password: 'dev-password-1' })
  assert.equal(error, null)
  return data.session!.access_token
}

async function vehicleWithPhotos(gallery: string, slots: string[]): Promise<{ vehicleId: string; photoIds: string[] }> {
  const admin = serviceClient()
  const vehicleId = crypto.randomUUID()
  assert.equal((await admin.from('vehicles').insert({ id: vehicleId, gallery_id: gallery, make: 'VW', model: 'Golf', body_type: 'hatchback' })).error, null)
  const photoIds = slots.map(() => crypto.randomUUID())
  const rows = slots.map((slot, i) => ({
    id: photoIds[i], vehicle_id: vehicleId, gallery_id: gallery, slot,
    original_path: `${gallery}/${vehicleId}/${slot}.jpg`, captured_at: new Date().toISOString(),
  }))
  assert.equal((await admin.from('photos').insert(rows)).error, null)
  return { vehicleId, photoIds }
}

const balance = async (gallery: string) => {
  const { data } = await serviceClient().from('credit_ledger').select('amount').eq('gallery_id', gallery)
  return (data ?? []).reduce((sum, r) => sum + r.amount, 0)
}

const processVehicle = (token: string | null, body: unknown) =>
  fetch(`${env().url}/functions/v1/process-vehicle`, {
    method: 'POST',
    headers: { apikey: env().anonKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

async function until<T>(check: () => Promise<T | undefined>, what: string): Promise<T> {
  for (let i = 0; i < 50; i++) {
    const value = await check()
    if (value !== undefined) return value
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`timed out waiting for ${what}`)
}

test('charges once and hands the photos to the worker', async () => {
  const owner = await signIn('owner@bambu.test')
  await serviceClient().rpc('admin_grant_credits', { p_gallery_id: TESTGALERIE, p_amount: 1, p_note: 'test' })
  const { vehicleId, photoIds } = await vehicleWithPhotos(TESTGALERIE, ['front_left_45', 'front'])
  const before = await balance(TESTGALERIE)

  const res = await processVehicle(owner, { vehicleId })
  assert.equal(res.status, 202)
  assert.deepEqual(new Set((await res.json()).queued), new Set(photoIds))
  const got = await until(async () => received.find((r) => r.body.vehicle_id === vehicleId), 'the worker call')
  assert.deepEqual(new Set(got.body.photo_ids), new Set(photoIds))
  assert.equal(got.secret, SECRET)
  assert.equal(await balance(TESTGALERIE), before - 1)

  const again = await processVehicle(owner, { vehicleId })
  assert.equal(again.status, 200)
  assert.deepEqual(await again.json(), { queued: [] })
  assert.equal(await balance(TESTGALERIE), before - 1)
})

test('answers 402 when the gallery has no credit', async () => {
  const other = await signIn('other@bambu.test')
  const { vehicleId } = await vehicleWithPhotos(ANDERE, ['front'])
  const res = await processVehicle(other, { vehicleId })
  assert.equal(res.status, 402)
  assert.deepEqual(await res.json(), { error: 'no_credit' })
})

test("answers 403 for another gallery's vehicle", async () => {
  const owner = await signIn('owner@bambu.test')
  const { vehicleId } = await vehicleWithPhotos(ANDERE, ['front'])
  const res = await processVehicle(owner, { vehicleId })
  assert.equal(res.status, 403)
  assert.deepEqual(await res.json(), { error: 'not_member' })
})

test('answers 400 for a malformed request and 401 without a token', async () => {
  const owner = await signIn('owner@bambu.test')
  assert.equal((await processVehicle(owner, '{not json')).status, 400)
  assert.equal((await processVehicle(owner, { vehicleId: 42 })).status, 400)
  assert.equal((await processVehicle(null, { vehicleId: crypto.randomUUID() })).status, 401)
})

test('marks photos failed when the worker is unreachable', async () => {
  await new Promise((r) => worker.close(r))
  try {
    const owner = await signIn('owner@bambu.test')
    await serviceClient().rpc('admin_grant_credits', { p_gallery_id: TESTGALERIE, p_amount: 1, p_note: 'test' })
    const { vehicleId, photoIds } = await vehicleWithPhotos(TESTGALERIE, ['rear'])
    assert.equal((await processVehicle(owner, { vehicleId })).status, 202)
    const row = await until(async () => {
      const { data } = await serviceClient().from('photos').select('process_status, process_error').eq('id', photoIds[0]).single()
      return data?.process_status === 'failed' ? data : undefined
    }, 'the photo to fail')
    assert.equal(row.process_error, 'worker_unreachable')
  } finally {
    await startWorker()
  }
})

test('a worker error leaves finished photos alone and the vehicle not stuck', async () => {
  workerMode = 'error'
  try {
    const owner = await signIn('owner@bambu.test')
    await serviceClient().rpc('admin_grant_credits', { p_gallery_id: TESTGALERIE, p_amount: 1, p_note: 'test' })
    const { vehicleId, photoIds } = await vehicleWithPhotos(TESTGALERIE, ['front', 'rear'])
    const res = await processVehicle(owner, { vehicleId })
    assert.equal(res.status, 202)
    const first = (await res.json()).queued[0] as string
    const other = photoIds.find((id) => id !== first)!
    const rows = await until(async () => {
      const { data } = await serviceClient().from('photos').select('id, process_status, process_error').in('id', photoIds)
      return data?.every((r) => r.process_status === 'done' || r.process_status === 'failed') ? data : undefined
    }, 'the photos to settle')
    assert.equal(rows.find((r) => r.id === first)!.process_status, 'done')
    assert.deepEqual(rows.find((r) => r.id === other), { id: other, process_status: 'failed', process_error: 'worker_unreachable' })
    const vehicle = await until(async () => {
      const { data } = await serviceClient().from('vehicles').select('status').eq('id', vehicleId).single()
      return data?.status === 'ready' ? data : undefined
    }, 'the vehicle to be ready')
    assert.equal(vehicle.status, 'ready')
  } finally {
    workerMode = 'ok'
  }
})

test('answers 409 when the vehicle has too many photos', async () => {
  const owner = await signIn('owner@bambu.test')
  await serviceClient().rpc('admin_grant_credits', { p_gallery_id: TESTGALERIE, p_amount: 1, p_note: 'test' })
  const { vehicleId } = await vehicleWithPhotos(TESTGALERIE, ['front'])
  assert.equal((await serviceClient().from('vehicles').update({ originals_count: 41 }).eq('id', vehicleId)).error, null)
  const res = await processVehicle(owner, { vehicleId })
  assert.equal(res.status, 409)
  assert.deepEqual(await res.json(), { error: 'photo_limit' })
})
