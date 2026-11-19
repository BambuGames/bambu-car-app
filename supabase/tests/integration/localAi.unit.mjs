import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { decide, envPointsAtFake, isLocalFakeUrl } from './localAi.mjs'

test('url rule', () => {
  assert.ok(isLocalFakeUrl('http://host.docker.internal:8091/v1'))
  assert.ok(isLocalFakeUrl('http://127.0.0.1:8091'))
  assert.ok(!isLocalFakeUrl('https://api.openai.com/v1'))
  assert.ok(!isLocalFakeUrl('http://127.0.0.1:80910/v1'))
  assert.ok(!isLocalFakeUrl(''))
})

test('env file', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'ai-')), '.env')
  assert.ok(!envPointsAtFake(f))
  writeFileSync(f, 'OPENAI_BASE_URL="http://host.docker.internal:8091/v1"\n')
  assert.ok(envPointsAtFake(f))
  writeFileSync(f, 'OPENAI_BASE_URL=http://host.docker.internal:8091/v1\nOPENAI_BASE_URL=\n')
  assert.ok(!envPointsAtFake(f))
})

test('decisions', () => {
  assert.equal(decide({ pointsAtFake: true, envMtimeMs: 1, startedAt: 2 }), null)
  assert.match(decide({ pointsAtFake: false, envMtimeMs: 1, startedAt: 2 }), /not the local fake/)
  assert.match(decide({ pointsAtFake: true, envMtimeMs: 1, startedAt: undefined }), /start the local stack/)
  assert.match(decide({ pointsAtFake: true, envMtimeMs: 3, startedAt: 2 }), /restart the stack/)
})
