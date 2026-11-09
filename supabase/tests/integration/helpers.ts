// Shared helpers for integration tests against the local Supabase stack.
// `npm run test:int` exports API_URL, ANON_KEY, SERVICE_ROLE_KEY and MAILPIT_URL from `supabase status`.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function env() {
  const { API_URL: url, ANON_KEY: anonKey, SERVICE_ROLE_KEY: serviceKey } = process.env
  if (!url || !anonKey || !serviceKey) {
    throw new Error('API_URL, ANON_KEY and SERVICE_ROLE_KEY must be set; run the tests with `npm run test:int`')
  }
  return { url, anonKey, serviceKey }
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
export const anonClient = (): SupabaseClient => createClient(env().url, env().anonKey, noSession)
export const serviceClient = (): SupabaseClient => createClient(env().url, env().serviceKey, noSession)

const mailUrl = () => process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'
const search = (email: string) => `${mailUrl()}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`

export async function clearMail(email: string): Promise<void> {
  await fetch(search(email), { method: 'DELETE' })
}

// The 6-digit code from the newest mail to `email`; waits up to 5 s for it to arrive.
export async function latestCode(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const { messages = [] } = await (await fetch(search(email))).json()
    if (messages.length > 0) {
      const message = await (await fetch(`${mailUrl()}/api/v1/message/${messages[0].ID}`)).json()
      const code = /\b(\d{6})\b/.exec(message.Text || message.HTML || '')?.[1]
      if (code) return code
      throw new Error(`newest mail to ${email} has no 6-digit code`)
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`no mail to ${email} arrived`)
}
