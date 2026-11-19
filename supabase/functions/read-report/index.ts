// Report reading (design 5.6): OpenAI reads an uploaded inspection report (a PDF or photos of its pages) and
// suggests field values, damage states and equipment, each with a short quote from the report. Nothing is
// written to the vehicle here: the dealer accepts or rejects every suggestion in the app.
//   POST { vehicle_id, read_id, files }   1–10 paths, each reports/{gallery}/{vehicle_id}/{read_id}/{name}
//     → 200 { read_id, suggestions }
// Every call past the checks is a report_reads row (id = read_id) that ends 'done' or 'failed'; a vehicle
// gets at most 10 of them in 24 hours. The VIN may be suggested: it is read from the report, not sent.
// Errors: 400 bad_request, 401 unauthorized, 403 not_member, 422 ai_refused, 429 daily_limit, 502 ai_failed, 500 internal.
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type OpenAI from 'npm:openai@7.59.0'
import { z } from 'npm:zod@4.6.7'

import { askJson } from '../_shared/ai.ts'
import {
  DAMAGE_PARTS, DAMAGE_STATES, type DamagePart, type DamageState, DRIVES, EQUIPMENT, type Equipment, EXTERIOR_COLORS, FUELS,
  INTERIOR_COLORS, TRANSMISSIONS, UPHOLSTERIES, validateVehicleData, type VehicleData,
} from '../_shared/vehicleData.ts'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const noSession = { persistSession: false, autoRefreshToken: false }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAILY_LIMIT = 10
const MAX_BYTES = 20 * 1024 * 1024 // all files together; as base64 they stay well under OpenAI's 50 MB of files per request
const QUOTE_MAX = 160

type Field = keyof VehicleData | 'make' | 'model'
type Suggestion =
  | { kind: 'field'; field: Field; value: string | number | boolean; quote: string }
  | { kind: 'damage'; part: DamagePart; state: DamageState; quote: string }
  | { kind: 'equipment'; code: Equipment; quote: string }

// The schema keeps the model to the value lists. OpenAI's strict schemas require every field: one the report
// does not state comes back null.
const VALUES = {
  make: z.string(), model: z.string(), variant: z.string(),
  firstRegistration: z.string(), mileageKm: z.int(), fuel: z.enum(FUELS), transmission: z.enum(TRANSMISSIONS),
  powerKw: z.int(), displacementCcm: z.int(), drive: z.enum(DRIVES),
  colorExterior: z.enum(EXTERIOR_COLORS), colorInterior: z.enum(INTERIOR_COLORS), upholstery: z.enum(UPHOLSTERIES),
  previousOwners: z.int(), huUntil: z.string(), accidentFree: z.boolean(), serviceBook: z.boolean(), nonSmoker: z.boolean(),
  vin: z.string(),
} satisfies Record<Field, z.ZodType>
const FIELDS = Object.keys(VALUES) as Field[]
// The vehicle's damage map keeps only parts that are not original, so 'original' would suggest nothing.
const STATES = DAMAGE_STATES.filter((s): s is Exclude<DamageState, 'original'> => s !== 'original')

// A value outside the schema (a slip, or the test fake) parses as "no suggestion" instead of failing the whole
// read; `.catch` leaves the JSON schema sent to OpenAI unchanged (required, null allowed).
const lenient = <T extends z.ZodType>(schema: T) => schema.nullable().catch(null)
const quoted = (field: Field) => lenient(z.object({ value: VALUES[field], quote: z.string() }))
const Report = z.object({
  ...Object.fromEntries(FIELDS.map((field) => [field, quoted(field)])) as Record<Field, ReturnType<typeof quoted>>,
  damage: z.array(lenient(z.object({ part: z.enum(DAMAGE_PARTS), state: z.enum(STATES), quote: z.string() }))),
  equipment: z.array(lenient(z.object({ code: z.enum(EQUIPMENT), quote: z.string() }))),
})

const SYSTEM = `You read a used car's inspection or appraisal report for a car dealer and suggest values for the vehicle's data. The dealer checks every suggestion before it is saved.

- Suggest only what the report states explicitly. Do not guess, infer or fill in typical values; leave out whatever the report does not state (a field it does not state is null).
- Give every suggestion a short quote from the report, a few words as written there, that shows where the value appears.
- The report is often in German. Map what it says to the codes in the schema; leave out anything no code matches.
- firstRegistration and huUntil (the next general inspection, HU) are months: write them as YYYY-MM-01.
- Mileage is in km, power in kW, displacement in cm³. If the report gives power only in PS, convert it (1 PS = 0.7355 kW) and quote the PS figure.
- vin is the 17-character vehicle identification number (FIN).
- damage lists only the body parts the report states are not original: painted, partly painted, replaced or damaged. Leave out parts it calls original and parts it does not mention.
- accidentFree only when the report says so in words; do not derive it from the damage.
- equipment lists only what the report names as fitted.`

const clip = (quote: string) => {
  const text = quote.replace(/\s+/g, ' ').trim()
  return text.length > QUOTE_MAX ? `${text.slice(0, QUOTE_MAX - 1)}…` : text
}
const allowed = (field: Field, value: unknown) =>
  field === 'make' || field === 'model'
    ? typeof value === 'string' && value.length <= 120
    : !validateVehicleData({ [field]: value })[field]

function suggestionsOf(report: z.infer<typeof Report>): Suggestion[] {
  const out: Suggestion[] = []
  for (const field of FIELDS) {
    const found = report[field]
    const value = typeof found?.value === 'string' ? found.value.trim() : found?.value
    const quote = clip(found?.quote ?? '')
    if (value !== undefined && value !== '' && quote && allowed(field, value)) out.push({ kind: 'field', field, value, quote })
  }
  for (const item of report.damage) {
    if (item && clip(item.quote)) out.push({ kind: 'damage', part: item.part, state: item.state, quote: clip(item.quote) })
  }
  for (const item of report.equipment) {
    if (item && clip(item.quote)) out.push({ kind: 'equipment', code: item.code, quote: clip(item.quote) })
  }
  return out
}

type Failure = { status: number; error: string }
const BAD_REQUEST: Failure = { status: 400, error: 'bad_request' }

async function read(admin: SupabaseClient, files: string[]): Promise<Suggestion[] | Failure> {
  // One file at a time, so only its raw bytes and the base64 blocks so far are in memory.
  const content: OpenAI.Responses.ResponseInputContent[] = []
  let total = 0
  for (const path of files) {
    const { data, error } = await admin.storage.from('reports').download(path)
    if ((error as { statusCode?: string } | null)?.statusCode === '404') return BAD_REQUEST
    if (error) throw error
    total += data.size
    if (total > MAX_BYTES) return BAD_REQUEST
    const type = data.type.split(';')[0] // the bucket only takes PDF, JPEG and PNG
    // detail 'high' throughout: inspection reports carry small print.
    if (type === 'application/pdf') {
      const filename = path.slice(path.lastIndexOf('/') + 1)
      content.push({ type: 'input_file', detail: 'high', filename, file_data: `data:${type};base64,${encodeBase64(await data.arrayBuffer())}` })
    } else if (type === 'image/jpeg' || type === 'image/png') {
      content.push({ type: 'input_image', detail: 'high', image_url: `data:${type};base64,${encodeBase64(await data.arrayBuffer())}` })
    } else {
      return BAD_REQUEST
    }
  }
  content.push({ type: 'input_text', text: "Read the report above and suggest the vehicle's data." })
  const answer = await askJson({ system: SYSTEM, content, schema: Report, effort: 'high' })
  if (!answer.ok) return { status: answer.error === 'ai_refused' ? 422 : 502, error: answer.error }
  return suggestionsOf(answer.value)
}

// The file name below the read's folder: one segment, not a relative one.
const isName = (name: string) => name !== '' && name !== '.' && name !== '..' && !name.includes('/')

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json(401, { error: 'unauthorized' })

  const body = await req.json().catch(() => null)
  const { vehicle_id: vehicleId, read_id: readId, files } = body ?? {}
  if (
    typeof vehicleId !== 'string' || !UUID.test(vehicleId) ||
    typeof readId !== 'string' || !UUID.test(readId) ||
    !Array.isArray(files) || files.length < 1 || files.length > 10 ||
    !files.every((path) => typeof path === 'string') || new Set(files).size !== files.length
  ) {
    return json(400, { error: 'bad_request' })
  }

  // Read as the user: row-level security answers whether they belong to the vehicle's gallery.
  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: noSession,
    global: { headers: { Authorization: authorization } },
  })
  const { data: vehicle, error: readError } = await user.from('vehicles').select('gallery_id').eq('id', vehicleId).maybeSingle()
  if (readError?.code === 'PGRST301' || readError?.message?.includes('JWT')) return json(401, { error: 'unauthorized' })
  if (readError) {
    console.error('read-report: reading the vehicle failed', readError)
    return json(500, { error: 'internal' })
  }
  if (!vehicle) return json(403, { error: 'not_member' })
  const folder = `${vehicle.gallery_id}/${vehicleId}/${readId}/`
  if (!files.every((path: string) => path.startsWith(folder) && isName(path.slice(folder.length)))) {
    return json(400, { error: 'bad_request' })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: noSession })
  // ponytail: two calls at once can both pass at 9; a counter row with a lock if that ever matters.
  const since = new Date(Date.now() - 24 * 3600_000).toISOString()
  const reads = await admin.from('report_reads').select('id', { count: 'exact', head: true }).eq('vehicle_id', vehicleId).gte('created_at', since)
  if (reads.error) {
    console.error('read-report: counting reads failed', reads.error)
    return json(500, { error: 'internal' })
  }
  if ((reads.count ?? 0) >= DAILY_LIMIT) return json(429, { error: 'daily_limit' })

  const opened = await admin.from('report_reads')
    .insert({ id: readId, gallery_id: vehicle.gallery_id, vehicle_id: vehicleId, files, status: 'reading' })
  if (opened.error?.code === '23505') return json(400, { error: 'bad_request' }) // this read id is taken
  if (opened.error) {
    console.error('read-report: opening the read failed', opened.error)
    return json(500, { error: 'internal' })
  }

  let result: Suggestion[] | Failure
  try {
    result = await read(admin, files)
  } catch (error) {
    console.error('read-report: reading the report failed', (error as Error)?.constructor?.name)
    result = { status: 500, error: 'internal' }
  }
  // A read the app closed meanwhile (it gave up waiting) stays closed and empty; that is not an error.
  const saved = await admin.from('report_reads')
    .update(Array.isArray(result) ? { status: 'done', suggestions: result } : { status: 'failed', error: result.error })
    .eq('id', readId)
    .is('closed_at', null)
  if (saved.error) {
    console.error('read-report: saving the read failed', saved.error)
    return json(500, { error: 'internal' })
  }
  return Array.isArray(result) ? json(200, { read_id: readId, suggestions: result }) : json(result.status, { error: result.error })
})
