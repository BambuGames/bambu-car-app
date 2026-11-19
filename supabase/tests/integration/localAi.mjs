// Shared by checkLocalAi.mjs and fakeOpenAI.ts: the no-real-OpenAI-call guard. Only the OPENAI_BASE_URL line of
// functions/.env is looked at, and no value is ever printed.
import { readFileSync, statSync } from 'node:fs'

export const ENV_FILE = new URL('../../functions/.env', import.meta.url)
export const CONTAINER = 'supabase_edge_runtime_bambu-car-app'

export function isLocalFakeUrl(value) {
  return !!value && /^http:\/\/(host\.docker\.internal|127\.0\.0\.1):8091(\/|$)/.test(value)
}

export function envPointsAtFake(file = ENV_FILE) {
  let value
  try {
    const line = readFileSync(file, 'utf8').split(/\r?\n/).findLast((l) => l.startsWith('OPENAI_BASE_URL='))
    value = line?.slice('OPENAI_BASE_URL='.length).trim().replace(/^(["'])(.*)\1$/, '$2')
  } catch {
    // No file: the same as no line.
  }
  return isLocalFakeUrl(value)
}

// null when fine, else a fixed message. `startedAt` is the runtime container's start time (ms), or undefined.
export function decide({ pointsAtFake, envMtimeMs, startedAt }) {
  if (!pointsAtFake) return 'OPENAI_BASE_URL in supabase/functions/.env is missing or not the local fake (port 8091); not running tests'
  if (startedAt === undefined || Number.isNaN(startedAt)) return 'edge runtime container not found: start the local stack (npm run db:start)'
  if (envMtimeMs >= startedAt) return 'supabase/functions/.env changed after the edge runtime started: restart the stack (npx supabase stop, then npm run db:start)'
  return null
}

export function envMtimeMs(file = ENV_FILE) {
  try { return statSync(file).mtimeMs } catch { return Infinity }
}
