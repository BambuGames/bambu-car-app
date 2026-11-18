// Claude calls for the Edge Functions (design 5.6–5.8): one structured-output request on claude-opus-5-5.
// Thinking is always on for this model, so no `thinking` is sent; `effort` sets the depth. A policy decline
// is retried server-side on Anthropic's default fallback model; if the whole chain declines, the answer is
// `ai_refused`. The key stays in the function secrets (locally in the git-ignored functions/.env).
import Anthropic from 'npm:@anthropic-ai/sdk@1.10.0'
import { betaZodOutputFormat } from 'npm:@anthropic-ai/sdk@1.10.0/helpers/beta/zod'
import type { z } from 'npm:zod@4.6.7'

export function claudeClient(): Anthropic {
  return new Anthropic({
    apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    baseURL: Deno.env.get('ANTHROPIC_BASE_URL') || undefined, // empty: the SDK default
  })
}

export type AskResult<T> = { ok: true; value: T; model: string } | { ok: false; error: 'ai_refused' | 'ai_failed' }

export async function askJson<T>(opts: {
  system: string
  content: Anthropic.Beta.BetaContentBlockParam[]
  schema: z.ZodType<T>
  effort: 'medium' | 'high'
}): Promise<AskResult<T>> {
  const format = betaZodOutputFormat(opts.schema)
  let response: Anthropic.Beta.BetaMessage
  try {
    response = await claudeClient().beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: opts.system,
      messages: [{ role: 'user', content: opts.content }],
      output_config: { effort: opts.effort, format },
    })
  } catch (error) {
    console.error('claude: request failed', String(error))
    return { ok: false, error: 'ai_failed' }
  }
  // stop_reason first: a refused answer's content is empty or partial.
  if (response.stop_reason === 'refusal') return { ok: false, error: 'ai_refused' }
  const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('')
  try {
    return { ok: true, value: format.parse(text), model: response.model } // JSON.parse + the zod schema
  } catch (error) {
    console.error('claude: unusable output', response.stop_reason, String(error))
    return { ok: false, error: 'ai_failed' }
  }
}
