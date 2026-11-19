// OpenAI calls for the Edge Functions (design 5.6–5.8): one structured-output request on gpt-6.2-sol through
// the Responses API; `effort` sets the reasoning depth. `store: false`: OpenAI does not keep the response for
// later retrieval (reports carry VINs, plates and owners). A refusal is `ai_refused`; there is no fallback
// model. The key stays in the function secrets (locally in the git-ignored functions/.env, next to the test
// fake's base URL).
import OpenAI from 'npm:openai@7.59.0'
import { zodTextFormat } from 'npm:openai@7.59.0/helpers/zod'
import type { z } from 'npm:zod@4.6.7'

export function aiClient(): OpenAI {
  return new OpenAI({
    apiKey: Deno.env.get('OPENAI_API_KEY'),
    baseURL: Deno.env.get('OPENAI_BASE_URL') || undefined, // empty: the SDK default
  })
}

// Numbers only: the real check reads the token usage from the function log.
function logUsage(response: OpenAI.Responses.Response): void {
  const u = response.usage
  console.log('ai: usage', { model: response.model, input: u?.input_tokens, output: u?.output_tokens, reasoning: u?.output_tokens_details?.reasoning_tokens })
}

export type AskResult<T> = { ok: true; value: T; model: string } | { ok: false; error: 'ai_refused' | 'ai_failed' }

export async function askJson<T>(opts: {
  system: string
  content: OpenAI.Responses.ResponseInputContent[]
  schema: z.ZodType<T>
  effort: 'medium' | 'high'
}): Promise<AskResult<T>> {
  let response
  try {
    // `parse` also checks the output text against the zod schema and throws when it does not fit.
    response = await aiClient().responses.parse({
      model: 'gpt-6.2-sol',
      reasoning: { effort: opts.effort },
      max_output_tokens: 16000,
      store: false,
      instructions: opts.system,
      input: [{ role: 'user', content: opts.content }],
      text: { format: zodTextFormat(opts.schema, 'answer') },
    })
  } catch (error) {
    // Never the message of a 401/403: it echoes part of the key. A 400 message describes the request only.
    if (error instanceof OpenAI.APIError) {
      const { status, code, param, type, requestID } = error
      console.error('ai: request failed', { status, code, param, type, requestID, ...(status === 400 && { message: error.message }) })
    } else {
      console.error('ai: request failed', (error as Error)?.constructor?.name)
    }
    return { ok: false, error: 'ai_failed' }
  }
  const parts = response.output.flatMap((item) => (item.type === 'message' ? item.content : []))
  if (parts.some((part) => part.type === 'refusal')) return { ok: false, error: 'ai_refused' }
  // A cut-off answer is never used, even when its text so far would parse.
  if (response.status !== 'completed' || response.output_parsed === null) {
    logUsage(response)
    console.error('ai: unusable output', response.status, response.incomplete_details?.reason, response.error?.code)
    return { ok: false, error: 'ai_failed' }
  }
  logUsage(response)
  return { ok: true, value: response.output_parsed, model: response.model }
}
