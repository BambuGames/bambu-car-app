// export-vehicle (spec 10): a member asks for a ZIP of a vehicle's photos; the image worker builds it and the
// function answers with a link valid for 7 days. A fake worker listens on the local worker port (8090; stop
// the real worker before these tests).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { after, before, test } from 'node:test'

import { anonClient, env, serviceClient } from './helpers.ts'

const TESTGALERIE = 'e0000000-0000-0000-0000-000000000001'
const ANDERE = 'e0000000-0000-0000-0000-000000000002'
const SECRET = /^WORKER_SECRET=(.*)$/m.exec(readFileSync(new URL('../../functions/.env', import.meta.url), 'utf8'))![1]
const SEVEN_DAYS = 7 * 24 * 3600 * 1000
// The smallest valid ZIP: an empty archive's end record.
const EMPTY_ZIP = Buffer.concat([Buffer.from('PK\x05\x06'), Buffer.alloc(18)])

type Received = { body: { vehicle_id: string; version: string; photo_ids: string[] }; secret: string | undefined }
const received: Received[] = []
let worker: Server | undefined
let workerMode: 'ok' | 'nothing' = 'ok'

function startWorker(): Promise<void> {
  worker = createServer((req: IncomingMessage, res) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', async () => {
      const body = JSON.parse(data)
      received.push({ body, secret: req.headers['x-worker-secret'] as string | undefined })
      if (workerMode === 'nothing') {
        res.writeHead(409, { 'Content-Type': 'application/json' }).end('{"detail":"nothing_to_export"}')
        return
      }
      const { data: vehicle } = await serviceClient().from('vehicles').select('gallery_id').eq('id', body.vehicle_id).single()
      const path = `${vehicle!.gallery_id}/${body.vehicle_id}/exports/${body.version}.zip`
      await serviceClient().storage.from('processed').upload(path, EMPTY_ZIP, { contentType: 'application/zip', upsert: true })
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ path, count: body.photo_ids.length, bytes: EMPTY_ZIP.length }))
    })
  })
  return new Promise((resolve) => worker!.listen(8090, '127.0.0.1', resolve))
}
const stopWorker = () => new Promise<void>((resolve) => (worker ? worker.close(() => resolve()) : resolve()))
before(startWorker)
after(stopWorker)

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

const exportVehicle = (token: string | null, body: unknown) =>
  fetch(`${env().url}/functions/v1/export-vehicle`, {
    method: 'POST',
    headers: { apikey: env().anonKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })

test('a member gets a 7-day link to the ZIP the worker built', async () => {
  workerMode = 'ok'
  const { vehicleId, photoIds } = await vehicleWithPhotos(TESTGALERIE, ['front_left_45', 'front'])
  const res = await exportVehicle(await signIn('owner@bambu.test'), { vehicleId, version: 'watermarked', photoIds })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.count, 2)
  assert.ok(Math.abs(Date.parse(body.expiresAt) - (Date.now() + SEVEN_DAYS)) < 60_000)
  assert.match(body.url, /download=VW-Golf\.zip/)
  const zip = Buffer.from(await (await fetch(body.url)).arrayBuffer())
  assert.equal(zip.subarray(0, 2).toString(), 'PK')
  const call = received.find((r) => r.body.vehicle_id === vehicleId)!
  assert.deepEqual(call.body, { vehicle_id: vehicleId, version: 'watermarked', photo_ids: photoIds })
  assert.equal(call.secret, SECRET)
})

test('staff can export too', async () => {
  workerMode = 'ok'
  const { vehicleId, photoIds } = await vehicleWithPhotos(TESTGALERIE, ['rear'])
  const res = await exportVehicle(await signIn('staff@bambu.test'), { vehicleId, version: 'originals', photoIds })
  assert.equal(res.status, 200)
})

test("another gallery's vehicle cannot be exported", async () => {
  const { vehicleId, photoIds } = await vehicleWithPhotos(ANDERE, ['front'])
  const res = await exportVehicle(await signIn('owner@bambu.test'), { vehicleId, version: 'plain', photoIds })
  assert.deepEqual({ status: res.status, body: await res.json() }, { status: 403, body: { error: 'not_member' } })
  assert.equal(received.some((r) => r.body.vehicle_id === vehicleId), false)
})

test('an unknown version or an empty list is refused', async () => {
  const owner = await signIn('owner@bambu.test')
  const { vehicleId, photoIds } = await vehicleWithPhotos(TESTGALERIE, ['front'])
  const tooMany = Array.from({ length: 41 }, () => crypto.randomUUID())
  for (const body of [
    { vehicleId, version: 'gif', photoIds },
    { vehicleId, version: 'plain', photoIds: [] },
    { vehicleId, version: 'plain', photoIds: tooMany },
    { vehicleId, version: 'plain', photoIds: ['not-a-uuid'] },
    { vehicleId: 'not-a-uuid', version: 'plain', photoIds },
  ]) {
    const res = await exportVehicle(owner, body)
    assert.deepEqual({ status: res.status, body: await res.json() }, { status: 400, body: { error: 'bad_request' } }, JSON.stringify(body))
  }
  assert.equal((await exportVehicle(null, { vehicleId, version: 'plain', photoIds })).status, 401)
})

test('nothing usable answers 409 nothing_to_export', async () => {
  workerMode = 'nothing'
  const { vehicleId, photoIds } = await vehicleWithPhotos(TESTGALERIE, ['front'])
  const res = await exportVehicle(await signIn('owner@bambu.test'), { vehicleId, version: 'plain', photoIds })
  assert.deepEqual({ status: res.status, body: await res.json() }, { status: 409, body: { error: 'nothing_to_export' } })
  workerMode = 'ok'
})

test('the worker being down answers 502 worker_unreachable', async () => {
  await stopWorker()
  try {
    const { vehicleId, photoIds } = await vehicleWithPhotos(TESTGALERIE, ['front'])
    const res = await exportVehicle(await signIn('owner@bambu.test'), { vehicleId, version: 'plain', photoIds })
    assert.deepEqual({ status: res.status, body: await res.json() }, { status: 502, body: { error: 'worker_unreachable' } })
  } finally {
    await startWorker()
  }
})
