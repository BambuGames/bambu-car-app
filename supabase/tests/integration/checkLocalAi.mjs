// Runs before test:int and test:int:mobile: refuses to go on when a test could reach the real OpenAI API.
import { execFileSync } from 'node:child_process'
import { CONTAINER, decide, envMtimeMs, envPointsAtFake } from './localAi.mjs'

let startedAt
try {
  startedAt = Date.parse(execFileSync('docker', ['inspect', '-f', '{{.State.StartedAt}}', CONTAINER], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim())
} catch {
  // Container missing.
}
const message = decide({ pointsAtFake: envPointsAtFake(), envMtimeMs: envMtimeMs(), startedAt })
if (message) {
  console.error(`checkLocalAi: ${message}`)
  process.exit(1)
}
