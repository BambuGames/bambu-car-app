// read-report (design 5.6): reads an uploaded vehicle report with Claude and suggests field values, damage
// states and equipment, each with a quote from the report. A fake Messages API listens on 8091 (fakeClaude.ts)
// and records what the function sends.
import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'

import { FUELS } from '../../functions/_shared/vehicleData.ts'
import { claudeRequests, replyNext, resetFakeClaude, startFakeClaude, stopFakeClaude } from './fakeClaude.ts'
import { anonClient, env, serviceClient } from './helpers.ts'

const TESTGALERIE = 'e0000000-0000-0000-0000-000000000001'
const ANDERE_GALERIE = 'e0000000-0000-0000-0000-000000000002'
const PDF = Buffer.from('%PDF-1.4\n% Gutachten\n%%EOF\n')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')
const uploaded: string[] = []

before(startFakeClaude)
beforeEach(resetFakeClaude)
after(async () => {
  if (uploaded.length) assert.equal((await serviceClient().storage.from('reports').remove(uploaded)).error, null)
  await stopFakeClaude()
})

async function signIn(email: string): Promise<string> {
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password: 'dev-password-1' })
  assert.equal(error, null)
  return data.session!.access_token
}

async function vehicle(): Promise<string> {
  const id = crypto.randomUUID()
  const { error } = await serviceClient().from('vehicles').insert({ id, gallery_id: TESTGALERIE, make: 'VW', model: 'Golf', body_type: 'hatchback' })
  assert.equal(error, null)
  return id
}

async function upload(path: string, bytes: Buffer | Uint8Array, contentType: string): Promise<string> {
  const { error } = await serviceClient().storage.from('reports').upload(path, bytes, { contentType })
  assert.equal(error, null)
  uploaded.push(path)
  return path
}

const readReport = (token: string, body: unknown) =>
  fetch(`${env().url}/functions/v1/read-report`, {
    method: 'POST',
    headers: { apikey: env().anonKey, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })

const readRow = async (id: string) =>
  (await serviceClient().from('report_reads').select('gallery_id, vehicle_id, files, status, error, suggestions').eq('id', id).maybeSingle()).data

test('read-report sends the PDF as a document and returns suggestions', async () => {
  const owner = await signIn('owner@bambu.test')
  const id = await vehicle()
  const readId = crypto.randomUUID()
  const folder = `${TESTGALERIE}/${id}/${readId}/`
  const files = [await upload(`${folder}gutachten.pdf`, PDF, 'application/pdf'), await upload(`${folder}seite-2.png`, PNG, 'image/png')]
  replyNext({
    output: {
      fuel: { value: 'diesel', quote: 'Kraftstoff: Diesel' },
      mileageKm: { value: 87000, quote: 'km-Stand 87.000' },
      vin: { value: 'WVWZZZ1KZAW000001', quote: 'FIN WVWZZZ1KZAW000001' },
      damage: [{ part: 'hood', state: 'painted', quote: 'Motorhaube lackiert' }],
      equipment: [{ code: 'navigation', quote: 'Navigationssystem' }],
    },
  })

  const res = await readReport(owner, { vehicle_id: id, read_id: readId, files })
  assert.equal(res.status, 200)
  const suggestions = [ // the schema's field order, then damage, then equipment
    { kind: 'field', field: 'mileageKm', value: 87000, quote: 'km-Stand 87.000' },
    { kind: 'field', field: 'fuel', value: 'diesel', quote: 'Kraftstoff: Diesel' },
    { kind: 'field', field: 'vin', value: 'WVWZZZ1KZAW000001', quote: 'FIN WVWZZZ1KZAW000001' },
    { kind: 'damage', part: 'hood', state: 'painted', quote: 'Motorhaube lackiert' },
    { kind: 'equipment', code: 'navigation', quote: 'Navigationssystem' },
  ]
  assert.deepEqual(await res.json(), { read_id: readId, suggestions })
  assert.deepEqual(await readRow(readId), { gallery_id: TESTGALERIE, vehicle_id: id, files, status: 'done', error: null, suggestions })

  assert.equal(claudeRequests.length, 1)
  const [sent] = claudeRequests
  assert.match(String(sent.headers['anthropic-beta']), /server-side-fallback-2026-07-01/)
  const request = JSON.parse(sent.body)
  assert.equal(request.model, 'claude-opus-5-5')
  assert.equal(request.max_tokens, 16000)
  assert.equal(request.thinking, undefined)
  assert.equal(request.fallbacks, 'default')
  assert.equal(request.output_config.effort, 'high')
  assert.equal(request.output_config.format.type, 'json_schema')
  assert.deepEqual(request.output_config.format.schema.properties.fuel.properties.value.enum, FUELS)
  const [document, image, text] = request.messages[0].content
  assert.deepEqual(document, { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: PDF.toString('base64') } })
  assert.deepEqual(image, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG.toString('base64') } })
  assert.equal(text.type, 'text')

  // A second call with the same read id does not overwrite the read.
  const again = await readReport(owner, { vehicle_id: id, read_id: readId, files })
  assert.deepEqual({ status: again.status, body: await again.json() }, { status: 400, body: { error: 'bad_request' } })
  assert.equal((await readRow(readId))?.status, 'done')
  assert.equal(claudeRequests.length, 1)
})

test('read-report drops suggestions outside the value lists', async () => {
  const owner = await signIn('owner@bambu.test')
  const id = await vehicle()
  const read = async (output: unknown) => {
    const readId = crypto.randomUUID()
    const file = await upload(`${TESTGALERIE}/${id}/${readId}/gutachten.pdf`, PDF, 'application/pdf')
    replyNext({ output })
    const res = await readReport(owner, { vehicle_id: id, read_id: readId, files: [file] })
    assert.equal(res.status, 200)
    return (await res.json()).suggestions
  }

  const longQuote = `Navigationssystem ${'x'.repeat(300)}`
  assert.deepEqual(await read({
    fuel: { value: 'kerosene', quote: 'Kraftstoff: Kerosin' },
    mileageKm: { value: -5, quote: 'km-Stand -5' },
    powerKw: { value: 110, quote: '  110 kW\n(150 PS) ' },
    huUntil: { value: '2027-03-15', quote: 'HU 15.03.2027' }, // not month precision
    previousOwners: { value: 2, quote: '   ' }, // nothing to show the user
    damage: [
      { part: 'wing', state: 'painted', quote: 'Flügel lackiert' },
      { part: 'hood', state: 'bent', quote: 'Motorhaube verbogen' },
      { part: 'roof', state: 'original', quote: 'Dach original' }, // the map keeps only non-original parts
    ],
    equipment: [{ code: 'jetpack', quote: 'Jetpack' }, { code: 'navigation', quote: longQuote }],
  }), [
    { kind: 'field', field: 'powerKw', value: 110, quote: '110 kW (150 PS)' },
    { kind: 'equipment', code: 'navigation', quote: `${longQuote.slice(0, 159)}…` },
  ])

  // The same field with a value from the list comes through.
  assert.deepEqual(await read({ fuel: { value: 'diesel', quote: 'Kraftstoff: Diesel' }, damage: [], equipment: [] }), [
    { kind: 'field', field: 'fuel', value: 'diesel', quote: 'Kraftstoff: Diesel' },
  ])
})

test('the eleventh read in a day answers 429 daily_limit', async () => {
  const owner = await signIn('owner@bambu.test')
  const id = await vehicle()
  const rows = Array.from({ length: 10 }, (_, i) => ({
    gallery_id: TESTGALERIE, vehicle_id: id, files: ['x'], status: 'done',
    created_at: new Date(Date.now() - (i === 0 ? 25 : 1) * 3600_000).toISOString(), // the first is older than a day
  }))
  assert.equal((await serviceClient().from('report_reads').insert(rows)).error, null)
  const call = () => {
    const readId = crypto.randomUUID()
    return readReport(owner, { vehicle_id: id, read_id: readId, files: [`${TESTGALERIE}/${id}/${readId}/fehlt.pdf`] })
  }

  // Nine reads in the last 24 hours: the tenth gets past the limit (and fails on the missing file, which still counts).
  const tenth = await call()
  assert.deepEqual({ status: tenth.status, body: await tenth.json() }, { status: 400, body: { error: 'bad_request' } })
  const eleventh = await call()
  assert.deepEqual({ status: eleventh.status, body: await eleventh.json() }, { status: 429, body: { error: 'daily_limit' } })

  const { count } = await serviceClient().from('report_reads').select('id', { count: 'exact', head: true }).eq('vehicle_id', id)
  assert.equal(count, 11)
  assert.equal(claudeRequests.length, 0)
})

test("a path outside the vehicle's folder answers 400", async () => {
  const owner = await signIn('owner@bambu.test')
  const id = await vehicle()
  const otherVehicle = await vehicle()
  const readId = crypto.randomUUID()
  const folder = `${TESTGALERIE}/${id}/${readId}/`
  for (const files of [
    [`${TESTGALERIE}/${otherVehicle}/${readId}/gutachten.pdf`],
    [`${ANDERE_GALERIE}/${id}/${readId}/gutachten.pdf`],
    [`${TESTGALERIE}/${id}/${crypto.randomUUID()}/gutachten.pdf`],
    [`${folder}gutachten.pdf`, `${folder}../gutachten.pdf`],
    [`${folder}`],
    [`${folder}a/gutachten.pdf`],
    [], // 1–10 files
    Array.from({ length: 11 }, (_, i) => `${folder}seite-${i}.png`),
  ]) {
    const res = await readReport(owner, { vehicle_id: id, read_id: readId, files })
    assert.deepEqual({ files, status: res.status, body: await res.json() }, { files, status: 400, body: { error: 'bad_request' } })
  }
  assert.equal(await readRow(readId), null)
  assert.equal(claudeRequests.length, 0)
})

test('a member of another gallery gets 403', async () => {
  const other = await signIn('other@bambu.test')
  const id = await vehicle()
  const readId = crypto.randomUUID()
  const file = await upload(`${TESTGALERIE}/${id}/${readId}/gutachten.pdf`, PDF, 'application/pdf')
  const res = await readReport(other, { vehicle_id: id, read_id: readId, files: [file] })
  assert.equal(res.status, 403)
  assert.deepEqual(await res.json(), { error: 'not_member' })
  assert.equal(await readRow(readId), null)
  assert.equal(claudeRequests.length, 0)
})

test('files over 20 MB together answer 400 before Claude is asked', async () => {
  const owner = await signIn('owner@bambu.test')
  const id = await vehicle()
  const readId = crypto.randomUUID()
  const half = new Uint8Array(10.5 * 1024 * 1024) // each under the bucket's 20 MB per file
  const files = [
    await upload(`${TESTGALERIE}/${id}/${readId}/teil-1.pdf`, half, 'application/pdf'),
    await upload(`${TESTGALERIE}/${id}/${readId}/teil-2.pdf`, half, 'application/pdf'),
  ]
  const res = await readReport(owner, { vehicle_id: id, read_id: readId, files })
  assert.equal(res.status, 400)
  assert.deepEqual(await res.json(), { error: 'bad_request' })
  assert.equal((await readRow(readId))?.status, 'failed')
  assert.equal(claudeRequests.length, 0)
})

test('a refusal answers 422 ai_refused and marks the read failed', async () => {
  const owner = await signIn('owner@bambu.test')
  const id = await vehicle()
  const readId = crypto.randomUUID()
  const file = await upload(`${TESTGALERIE}/${id}/${readId}/gutachten.pdf`, PDF, 'application/pdf')
  replyNext({ refusal: true })
  const res = await readReport(owner, { vehicle_id: id, read_id: readId, files: [file] })
  assert.equal(res.status, 422)
  assert.deepEqual(await res.json(), { error: 'ai_refused' })
  const row = await readRow(readId)
  assert.deepEqual([row?.status, row?.error, row?.suggestions], ['failed', 'ai_refused', null])
})

test('a read the app closed while Claude was still reading keeps no suggestions', async () => {
  const owner = await signIn('owner@bambu.test')
  const id = await vehicle()
  const readId = crypto.randomUUID()
  const file = await upload(`${TESTGALERIE}/${id}/${readId}/gutachten.pdf`, PDF, 'application/pdf')
  replyNext({
    output: { mileageKm: { value: 87000, quote: 'km-Stand 87.000' }, damage: [], equipment: [] },
    // The app timed out and closed the read (as its close does) before the answer came back.
    before: async () => {
      const closed = await serviceClient().from('report_reads')
        .update({ suggestions: null, closed_at: new Date().toISOString() }).eq('id', readId).select('id')
      assert.equal(closed.data?.length, 1)
    },
  })
  const res = await readReport(owner, { vehicle_id: id, read_id: readId, files: [file] })
  assert.equal(res.status, 200) // not an error: the caller has gone, there is nothing to tell it
  const { data: row } = await serviceClient().from('report_reads').select('suggestions, closed_at').eq('id', readId).single()
  assert.equal(row?.suggestions, null)
  assert.notEqual(row?.closed_at, null)
})
