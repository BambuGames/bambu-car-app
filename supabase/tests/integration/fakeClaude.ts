// A stand-in for the Claude Messages API on 127.0.0.1:8091; the functions reach it as
// host.docker.internal:8091 through ANTHROPIC_BASE_URL in supabase/functions/.env. It records every
// request and answers each one with the reply a test queued: a structured output (sent as the JSON text
// block) or a refusal. Without a queued reply it answers 400, which the SDK does not retry.
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'

export type ClaudeRequest = { url: string; headers: IncomingHttpHeaders; body: string }
// `before` runs while the function waits for the answer (for example, the app giving up and closing the read).
export type ClaudeReply = ({ output: unknown; model?: string } | { refusal: true }) & { before?: () => Promise<void> }

export const claudeRequests: ClaudeRequest[] = []
const replies: ClaudeReply[] = []
let server: Server | undefined

export function replyNext(reply: ClaudeReply): void {
  replies.push(reply)
}

// Forgets the recorded requests and any reply a failed test left queued.
export function resetFakeClaude(): void {
  claudeRequests.length = 0
  replies.length = 0
}

function message(reply: ClaudeReply) {
  const common = { id: 'msg_fake', type: 'message', role: 'assistant', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }
  if ('refusal' in reply) {
    return { ...common, model: 'claude-opus-5-5', content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: null } }
  }
  return {
    ...common,
    model: reply.model ?? 'claude-opus-5-5',
    content: [{ type: 'text', text: JSON.stringify(reply.output) }],
    stop_reason: 'end_turn',
    stop_details: null,
  }
}

export function startFakeClaude(): Promise<void> {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', async () => {
      // Beta calls add `?beta=true`, so any query string is fine.
      if (req.method !== 'POST' || !req.url?.startsWith('/v1/messages')) {
        res.writeHead(404).end()
        return
      }
      claudeRequests.push({ url: req.url, headers: req.headers, body })
      const reply = replies.shift()
      if (!reply) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
          .end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'fakeClaude: no reply queued' } }))
        return
      }
      await reply.before?.()
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(message(reply)))
    })
  })
  return new Promise((resolve) => server!.listen(8091, '127.0.0.1', resolve))
}

export function stopFakeClaude(): Promise<void> {
  return new Promise((resolve) => (server ? server.close(() => resolve()) : resolve()))
}
