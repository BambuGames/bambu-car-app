// write-listing (design 5.7): writes a vehicle's listing text with Claude and stores it per language.
// A fake Messages API listens on 8091 (fakeClaude.ts) and records what the function sends.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'

import { claudeRequests, replyNext, startFakeClaude, stopFakeClaude } from './fakeClaude.ts'
import { anonClient, env, serviceClient } from './helpers.ts'

const TESTGALERIE = 'e0000000-0000-0000-0000-000000000001'
const VIN = 'WVWZZZ1KZAW000001'
const GERMAN = {
  titles: ['VW Golf, Navi, Sitzheizung', 'Gepflegter VW Golf mit neuem Zahnriemen', 'VW Golf aus erster Hand'],
  sections: [
    { heading: 'Überblick', body: 'Ein gepflegter Golf.' },
    { heading: 'Ausstattung', body: 'Navigation, Sitzheizung.' },
  ],
}

before(startFakeClaude)
after(stopFakeClaude)

async function signIn(email: string): Promise<string> {
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password: 'dev-password-1' })
  assert.equal(error, null)
  return data.session!.access_token
}

async function vehicle(fields: Record<string, unknown> = {}): Promise<string> {
  const id = crypto.randomUUID()
  const { error } = await serviceClient().from('vehicles').insert({
    id, gallery_id: TESTGALERIE, make: 'VW', model: 'Golf', body_type: 'hatchback', mileage_km: 84000,
    details: { equipment: ['navigation', 'seat_heating'], notes: 'Zahnriemen neu' }, ...fields,
  })
  assert.equal(error, null)
  return id
}

const writeListing = (token: string, body: unknown) =>
  fetch(`${env().url}/functions/v1/write-listing`, {
    method: 'POST',
    headers: { apikey: env().anonKey, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })

// The one request the function sent to Claude after the first `since` requests.
function sentAfter(since: number) {
  assert.equal(claudeRequests.length, since + 1)
  return claudeRequests[since]
}

test('write-listing returns three titles and stores the text', async () => {
  const owner = await signIn('owner@bambu.test')
  const id = await vehicle() // no listings row yet: the function opens one
  const since = claudeRequests.length
  replyNext({ output: GERMAN, model: 'claude-opus-5' }) // as if the fallback model answered

  const res = await writeListing(owner, { vehicle_id: id, language: 'de' })
  assert.equal(res.status, 200)
  const { generated_at, ...text } = await res.json()
  const description = '## Überblick\nEin gepflegter Golf.\n\n## Ausstattung\nNavigation, Sitzheizung.'
  assert.deepEqual(text, {
    listing_id: id, language: 'de', titles: GERMAN.titles, title: GERMAN.titles[0], description, model: 'claude-opus-5', edited: false,
  })

  const { data: row } = await serviceClient().from('listing_texts')
    .select('titles, title, description, model, generated_at, edited').eq('listing_id', id).eq('language', 'de').single()
  assert.deepEqual({ ...row, generated_at: new Date(row!.generated_at).toISOString() }, {
    titles: GERMAN.titles, title: GERMAN.titles[0], description, model: 'claude-opus-5', generated_at, edited: false,
  })

  // The listing the function opened is not newer than its text, so the app shows no "out of date" note.
  const { data: listing } = await serviceClient().from('listings').select('facts_updated_at').eq('id', id).single()
  assert.ok(Date.parse(generated_at) >= Date.parse(listing!.facts_updated_at), 'generated_at is before the listing it opened')

  const sent = sentAfter(since)
  assert.match(String(sent.headers['anthropic-beta']), /server-side-fallback-2026-07-01/)
  const request = JSON.parse(sent.body)
  assert.equal(request.model, 'claude-opus-5-5')
  assert.equal(request.max_tokens, 16000)
  assert.equal(request.thinking, undefined)
  assert.equal(request.fallbacks, 'default')
  assert.equal(request.output_config.effort, 'medium')
  assert.equal(request.output_config.format.type, 'json_schema')
})

test('write-listing never sends the VIN', async () => {
  const owner = await signIn('owner@bambu.test')
  const id = await vehicle({ vin: VIN })
  assert.equal((await serviceClient().from('listings').insert({ id, gallery_id: TESTGALERIE, price_eur: 15900 })).error, null)
  const since = claudeRequests.length
  replyNext({ output: GERMAN })

  assert.equal((await writeListing(owner, { vehicle_id: id, language: 'de' })).status, 200)
  const { body } = sentAfter(since)
  assert.ok(body.includes('15900'), 'the listing facts are sent')
  assert.ok(!body.includes(VIN))
})

test('write-listing leaves damage out until the map is checked', async () => {
  const owner = await signIn('owner@bambu.test')
  const id = await vehicle({ damage: { hood: 'painted' } })
  let since = claudeRequests.length
  replyNext({ output: GERMAN })
  assert.equal((await writeListing(owner, { vehicle_id: id, language: 'de' })).status, 200)
  assert.ok(!sentAfter(since).body.includes('hood'))

  assert.equal((await serviceClient().from('vehicles').update({ damage_checked_at: new Date().toISOString() }).eq('id', id)).error, null)
  since = claudeRequests.length
  replyNext({ output: GERMAN })
  assert.equal((await writeListing(owner, { vehicle_id: id, language: 'de' })).status, 200)
  assert.ok(sentAfter(since).body.includes('hood'))
})

test('a member of another gallery gets 403 not_member', async () => {
  const other = await signIn('other@bambu.test')
  const id = await vehicle()
  const since = claudeRequests.length
  const res = await writeListing(other, { vehicle_id: id, language: 'de' })
  assert.equal(res.status, 403)
  assert.deepEqual(await res.json(), { error: 'not_member' })
  assert.equal(claudeRequests.length, since)
})

test('a refusal answers 422 ai_refused', async () => {
  const owner = await signIn('owner@bambu.test')
  const id = await vehicle()
  replyNext({ refusal: true })
  const res = await writeListing(owner, { vehicle_id: id, language: 'de' })
  assert.equal(res.status, 422)
  assert.deepEqual(await res.json(), { error: 'ai_refused' })
  const { data } = await serviceClient().from('listing_texts').select('language').eq('listing_id', id)
  assert.deepEqual(data, [])
})

test('shorten without an existing text answers 400 bad_request', async () => {
  const owner = await signIn('owner@bambu.test')
  const id = await vehicle()
  const since = claudeRequests.length
  const res = await writeListing(owner, { vehicle_id: id, language: 'de', command: 'shorten' })
  assert.equal(res.status, 400)
  assert.deepEqual(await res.json(), { error: 'bad_request' })
  assert.equal(claudeRequests.length, since)
})

test('translate sends the text in from_language and stores the new language', async () => {
  const owner = await signIn('owner@bambu.test')
  const id = await vehicle()
  replyNext({ output: GERMAN })
  assert.equal((await writeListing(owner, { vehicle_id: id, language: 'de' })).status, 200)

  const english = { titles: ['VW Golf, navigation, heated seats', 'Well kept VW Golf', 'VW Golf, one owner'], sections: [{ heading: 'Overview', body: 'A well kept Golf.' }] }
  const since = claudeRequests.length
  replyNext({ output: english })
  const res = await writeListing(owner, { vehicle_id: id, language: 'en', command: 'translate', from_language: 'de' })
  assert.equal(res.status, 200)
  assert.equal((await res.json()).description, '## Overview\nA well kept Golf.')
  assert.ok(sentAfter(since).body.includes('Ein gepflegter Golf.'))

  const { data } = await serviceClient().from('listing_texts').select('language').eq('listing_id', id).order('language')
  assert.deepEqual(data, [{ language: 'de' }, { language: 'en' }])
})
