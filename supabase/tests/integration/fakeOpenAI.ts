// A stand-in for the OpenAI Responses API on 127.0.0.1:8091; the functions reach it as
// host.docker.internal:8091/v1 through OPENAI_BASE_URL in supabase/functions/.env. It records every
// request and answers each one with the reply a test queued: a structured output (sent as the JSON
// output_text), a refusal, or an answer cut off (status incomplete). Without a queued reply it answers
// 400, which the SDK does not retry.
import { envPointsAtFake } from './localAi.mjs'
import { createServer, type Server } from 'node:http'

// Headers are not kept: they carry the key from functions/.env, which may be a real one.
export type OpenAIRequest = { url: string; body: string }
// `before` runs while the function waits for the answer (for example, the app giving up and closing the read).
// An incomplete reply sends `output` (or a cut-off JSON text without it), so a test can show that even a valid
// text is not used.
export type OpenAIReply =
  & ({ output: unknown; model?: string } | { refusal: true } | { incomplete: true; output?: unknown })
  & { before?: () => Promise<void> }

export const openaiRequests: OpenAIRequest[] = []
const replies: OpenAIReply[] = []
let server: Server | undefined

export function replyNext(reply: OpenAIReply): void {
  replies.push(reply)
}

// Forgets the recorded requests and any reply a failed test left queued.
export function resetFakeOpenAI(): void {
  openaiRequests.length = 0
  replies.length = 0
}

// A Responses API response object, as `client.responses.parse` reads it.
function response(reply: OpenAIReply) {
  const incomplete = 'incomplete' in reply
  const content = 'refusal' in reply
    ? { type: 'refusal', refusal: "I'm sorry, I can't help with that." }
    : { type: 'output_text', text: reply.output === undefined ? '{"' : JSON.stringify(reply.output), annotations: [] }
  return {
    id: 'resp_fake',
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    status: incomplete ? 'incomplete' : 'completed',
    incomplete_details: incomplete ? { reason: 'max_output_tokens' } : null,
    error: null,
    model: ('model' in reply && reply.model) || 'gpt-6.2-sol',
    output: [{ id: 'msg_fake', type: 'message', role: 'assistant', status: incomplete ? 'incomplete' : 'completed', content: [content] }],
    instructions: null,
    metadata: {},
    parallel_tool_calls: true,
    temperature: 1,
    tool_choice: 'auto',
    tools: [],
    top_p: 1,
    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
  }
}

// Without OPENAI_BASE_URL pointing here the functions would call the real API with the key in functions/.env,
// so the fake refuses to start. checkLocalAi.mjs also runs before the test scripts (and checks the runtime).
function assertLocalBaseUrl(): void {
  if (!envPointsAtFake()) {
    throw new Error('fakeOpenAI: OPENAI_BASE_URL in supabase/functions/.env is missing or not the local fake (port 8091); not starting, so no test can reach the real OpenAI API')
  }
}

export function startFakeOpenAI(): Promise<void> {
  assertLocalBaseUrl()
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', async () => {
      if (req.method !== 'POST' || req.url?.split('?')[0] !== '/v1/responses') {
        res.writeHead(404).end()
        return
      }
      openaiRequests.push({ url: req.url, body })
      const reply = replies.shift()
      if (!reply) {
        res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({
          error: { message: 'fakeOpenAI: no reply queued', type: 'invalid_request_error', param: null, code: null },
        }))
        return
      }
      await reply.before?.()
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(response(reply)))
    })
  })
  return new Promise((resolve) => server!.listen(8091, '127.0.0.1', resolve))
}

export function stopFakeOpenAI(): Promise<void> {
  return new Promise((resolve) => (server ? server.close(() => resolve()) : resolve()))
}
