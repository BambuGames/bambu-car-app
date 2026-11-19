// Listing text (design 5.7): OpenAI writes three title options and a sectioned description from the
// vehicle's stored facts and the listing's sale fields, in one language; commands rework the stored text.
//   POST { vehicle_id, language, command?, from_language? }
//     → 200 { listing_id, language, titles, title, description, model, generated_at, edited: false }
// The text replaces the language's earlier one. The VIN is never read here, so it never reaches OpenAI.
// Errors: 400 bad_request, 401 unauthorized, 403 not_member, 422 ai_refused, 502 ai_failed, 500 internal.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { z } from 'npm:zod@4.6.7'

import { askJson } from '../_shared/ai.ts'
import { LANGUAGES, type Language } from '../_shared/vehicleData.ts'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const noSession = { persistSession: false, autoRefreshToken: false }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NAMES: Record<Language, string> = { de: 'German', tr: 'Turkish', en: 'English' }
const REWRITES = {
  shorten: 'Make the current text shorter.',
  more_professional: 'Rewrite the current text in a more professional tone.',
  highlight_equipment: 'Rewrite the current text so that the equipment stands out.',
  simplify: 'Rewrite the current text in simpler words.',
}
const isLanguage = (v: unknown): v is Language => (LANGUAGES as readonly unknown[]).includes(v)

// Every column but `vin` (and the bookkeeping ones).
const VEHICLE_COLUMNS = 'gallery_id, make, model, variant, body_type, first_registration, mileage_km, fuel, transmission, ' +
  'power_kw, displacement_ccm, drive, color_exterior, color_interior, upholstery, previous_owners, hu_until, ' +
  'accident_free, service_book, non_smoker, details, damage, damage_checked_at'

const Listing = z.object({
  titles: z.array(z.string()).length(3),
  sections: z.array(z.object({ heading: z.string(), body: z.string() })).min(1),
})

const system = (language: Language) => `You write the text of a used car listing for a dealer.

- Use only the vehicle data you are given. Do not mention equipment, condition or history that the data does not contain.
- No exaggeration, and no promises beyond the stated warranty.
- Write in ${NAMES[language]}, headings included. Write codes (equipment, fuel, colours, upholstery and the like) as the established ${NAMES[language]} terms for them; for example, seat_heating is "Sitzheizung" in German.
- Dates are month precision (YYYY-MM-01). Give power in kW and PS.
- \`damage\` lists the body parts that are not original, with their state; every part it does not list was checked and is original. Without \`damage\`, say nothing about paint or body damage and do not claim that parts are original. \`accident_free\` is the dealer's own statement; do not derive it from \`damage\`.
- Give three title options, and the description as sections in this order: summary, technical data, equipment, condition and history, price and warranty. Leave out a section that would be empty. Section bodies are plain text.
- When you are given a current text, rework it as asked and keep it true to the vehicle data.`

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json(401, { error: 'unauthorized' })

  const body = await req.json().catch(() => null)
  const { vehicle_id: vehicleId, language, command, from_language: fromLanguage } = body ?? {}
  if (
    typeof vehicleId !== 'string' || !UUID.test(vehicleId) ||
    !isLanguage(language) ||
    (command !== undefined && command !== 'translate' && !Object.hasOwn(REWRITES, command)) ||
    (command === 'translate' && !isLanguage(fromLanguage))
  ) {
    return json(400, { error: 'bad_request' })
  }

  // Read as the user: row-level security answers whether they belong to the vehicle's gallery.
  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: noSession,
    global: { headers: { Authorization: authorization } },
  })
  const [vehicleRead, listingRead] = await Promise.all([
    user.from('vehicles').select(VEHICLE_COLUMNS).eq('id', vehicleId).maybeSingle(),
    user.from('listings').select('price_eur, vat_deductible, warranty_months, location').eq('id', vehicleId).maybeSingle(),
  ])
  const readError = vehicleRead.error ?? listingRead.error
  if (readError?.code === 'PGRST301' || readError?.message?.includes('JWT')) return json(401, { error: 'unauthorized' })
  if (readError) {
    console.error('write-listing: reading the vehicle failed', readError)
    return json(500, { error: 'internal' })
  }
  if (!vehicleRead.data) return json(403, { error: 'not_member' })
  const { gallery_id: galleryId, details, damage, damage_checked_at: damageCheckedAt, ...fields } = vehicleRead.data

  let current = ''
  if (command) {
    const source: Language = command === 'translate' ? fromLanguage : language
    const { data: text, error } = await user.from('listing_texts').select('title, description')
      .eq('listing_id', vehicleId).eq('language', source).maybeSingle()
    if (error) {
      console.error('write-listing: reading the current text failed', error)
      return json(500, { error: 'internal' })
    }
    if (!text) return json(400, { error: 'bad_request' }) // nothing to rework
    current = `\n\nCurrent text (${NAMES[source]}):\n${text.title}\n\n${text.description}`
  }

  const facts = Object.fromEntries(Object.entries({
    ...fields,
    equipment: details?.equipment,
    damage: damageCheckedAt ? damage : undefined, // an unchecked map says nothing (design 5.5)
    ...listingRead.data,
    notes: details?.notes,
  }).filter(([, value]) => value !== null && value !== undefined && value !== ''))
  const task = !command ? 'Write the listing.'
    : command === 'translate' ? `Translate the current text into ${NAMES[language]}.`
    : REWRITES[command as keyof typeof REWRITES]

  const answer = await askJson({
    system: system(language),
    content: [{ type: 'input_text', text: `Vehicle data (JSON):\n${JSON.stringify(facts)}${current}\n\n${task}` }],
    schema: Listing,
    effort: 'medium',
  })
  if (!answer.ok) return json(answer.error === 'ai_refused' ? 422 : 502, { error: answer.error })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: noSession })
  if (!listingRead.data) {
    // A text needs its listing, and the app may not have saved one yet. Its facts_updated_at is the epoch, not the
    // database's clock: a text written now must never look older than the empty listing it was written for.
    const opened = await admin.from('listings')
      .upsert({ id: vehicleId, gallery_id: galleryId, facts_updated_at: new Date(0).toISOString() }, { onConflict: 'id', ignoreDuplicates: true })
    if (opened.error) {
      console.error('write-listing: opening the listing failed', opened.error)
      return json(500, { error: 'internal' })
    }
  }
  const { titles, sections } = answer.value
  const row = {
    listing_id: vehicleId,
    language,
    titles,
    title: titles[0],
    description: sections.map((s) => `## ${s.heading}\n${s.body}`).join('\n\n'),
    model: answer.model,
    generated_at: new Date().toISOString(),
    edited: false,
  }
  const saved = await admin.from('listing_texts').upsert({ ...row, gallery_id: galleryId }, { onConflict: 'listing_id,language' })
  if (saved.error) {
    console.error('write-listing: saving the text failed', saved.error)
    return json(500, { error: 'internal' })
  }
  return json(200, row)
})
