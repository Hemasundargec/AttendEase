import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { validateWaitlist } from '../src/validate.js'
import { issueFormToken, checkFormToken } from '../src/formToken.js'

const SECRET = 'test-secret'

function memoryStorage() {
  const rows = []
  return {
    kind: 'memory',
    rows,
    async addSignup(v) {
      if (rows.some((r) => r.email === v.email)) return false
      rows.push(v)
      return true
    },
  }
}

async function withServer(options, fn) {
  const storage = memoryStorage()
  const app = createApp({ storage, formSecret: SECRET, minFormAgeMs: 0, ...options })
  const server = app.listen(0)
  const base = `http://127.0.0.1:${server.address().port}`
  try { await fn({ base, storage }) } finally { server.close() }
}

const post = (base, body, headers = {}) =>
  fetch(`${base}/api/waitlist`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })

const goodBody = () => ({ name: 'Asha  Rao', email: 'Asha@Example.com ', agreed: true, website: '', formToken: issueFormToken(SECRET) })

test('validateWaitlist: accepts good input and normalises it', () => {
  const r = validateWaitlist({ name: ' Asha  Rao ', email: ' Asha@Example.com ', agreed: true })
  assert.equal(r.ok, true)
  assert.deepEqual(r.value, { name: 'Asha Rao', email: 'asha@example.com' })
})

test('validateWaitlist: reports every bad field', () => {
  const r = validateWaitlist({ name: '', email: 'nope', agreed: false })
  assert.equal(r.ok, false)
  assert.deepEqual(Object.keys(r.fieldErrors).sort(), ['agreed', 'email', 'name'])
})

test('validateWaitlist: rejects non-string and oversized values', () => {
  assert.equal(validateWaitlist({ name: { $gt: '' }, email: ['a@b.co'], agreed: true }).ok, false)
  assert.equal(validateWaitlist({ name: 'x'.repeat(81), email: 'a@b.co', agreed: true }).fieldErrors.name !== undefined, true)
})

test('form token: valid, too fast, forged, expired', () => {
  const now = 1_000_000
  const token = issueFormToken(SECRET, now)
  assert.equal(checkFormToken(SECRET, token, { now: now + 5000 }), null)
  assert.equal(checkFormToken(SECRET, token, { now: now + 500 }), 'too-fast')
  assert.equal(checkFormToken('other-secret', token, { now: now + 5000 }), 'invalid')
  assert.equal(checkFormToken(SECRET, token, { now: now + 3 * 60 * 60 * 1000 }), 'expired')
  assert.equal(checkFormToken(SECRET, undefined), 'missing')
})

test('POST /api/waitlist stores a valid signup', async () => {
  await withServer({}, async ({ base, storage }) => {
    const res = await post(base, goodBody())
    assert.equal(res.status, 201)
    assert.deepEqual(storage.rows.map((r) => r.email), ['asha@example.com'])
  })
})

test('duplicate email gets the same success reply and is not stored twice', async () => {
  await withServer({}, async ({ base, storage }) => {
    assert.equal((await post(base, goodBody())).status, 201)
    assert.equal((await post(base, goodBody())).status, 201)
    assert.equal(storage.rows.length, 1)
  })
})

test('honeypot: looks successful to the bot but stores nothing', async () => {
  await withServer({}, async ({ base, storage }) => {
    const res = await post(base, { ...goodBody(), website: 'http://spam.example' })
    assert.equal(res.status, 200)
    assert.equal(storage.rows.length, 0)
  })
})

test('rejects submissions that are too fast, unsigned, or invalid', async () => {
  await withServer({ minFormAgeMs: 60_000 }, async ({ base, storage }) => {
    assert.equal((await post(base, goodBody())).status, 400) // too fast
    assert.equal((await post(base, { ...goodBody(), formToken: 'x.y' })).status, 400) // forged
    assert.equal(storage.rows.length, 0)
  })
  await withServer({}, async ({ base }) => {
    const res = await post(base, { ...goodBody(), email: 'bad' })
    assert.equal(res.status, 400)
    assert.ok((await res.json()).fieldErrors.email)
  })
})

test('Turnstile: blocks when the check fails, allows when it passes', async () => {
  await withServer({ turnstileSecret: 's', verifyTurnstile: async () => false }, async ({ base, storage }) => {
    assert.equal((await post(base, { ...goodBody(), turnstileToken: 't' })).status, 400)
    assert.equal(storage.rows.length, 0)
  })
  await withServer({ turnstileSecret: 's', verifyTurnstile: async () => true }, async ({ base }) => {
    assert.equal((await post(base, { ...goodBody(), turnstileToken: 't' })).status, 201)
  })
})

test('rate limit: the 4th attempt in the window gets 429', async () => {
  await withServer({ signupLimit: { windowMs: 60_000, max: 3 } }, async ({ base }) => {
    for (let i = 0; i < 3; i++) await post(base, { ...goodBody(), email: `u${i}@example.com` })
    assert.equal((await post(base, goodBody())).status, 429)
  })
})

test('malformed JSON gets a clean 400, not a stack trace', async () => {
  await withServer({}, async ({ base }) => {
    const res = await fetch(`${base}/api/waitlist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })
    assert.equal(res.status, 400)
    assert.equal((await res.json()).message, 'Invalid request.')
  })
})

test('production: plain HTTP is redirected to HTTPS, HTTPS is served, health check is exempt', async () => {
  await withServer({ isProduction: true }, async ({ base }) => {
    const http = await fetch(`${base}/api/form-token`, { redirect: 'manual', headers: { 'X-Forwarded-Proto': 'http' } })
    assert.equal(http.status, 301)
    assert.match(http.headers.get('location'), /^https:\/\/127\.0\.0\.1:\d+\/api\/form-token$/)

    const https = await fetch(`${base}/api/form-token`, { redirect: 'manual', headers: { 'X-Forwarded-Proto': 'https' } })
    assert.equal(https.status, 200)
    assert.match(https.headers.get('strict-transport-security'), /max-age=63072000/)

    const health = await fetch(`${base}/api/health`, { redirect: 'manual', headers: { 'X-Forwarded-Proto': 'http' } })
    assert.equal(health.status, 200)
  })
})

test('production: canonicalHost pins the redirect target', async () => {
  await withServer({ isProduction: true, canonicalHost: 'attendease.example' }, async ({ base }) => {
    const res = await fetch(`${base}/privacy?x=1`, { redirect: 'manual', headers: { 'X-Forwarded-Proto': 'http' } })
    assert.equal(res.status, 301)
    assert.equal(res.headers.get('location'), 'https://attendease.example/privacy?x=1')
  })
})

test('development: no HTTPS redirect', async () => {
  await withServer({ isProduction: false }, async ({ base }) => {
    assert.equal((await fetch(`${base}/api/health`, { headers: { 'X-Forwarded-Proto': 'http' } })).status, 200)
  })
})

test('security headers are present and unknown API routes return JSON 404', async () => {
  await withServer({}, async ({ base }) => {
    const res = await fetch(`${base}/api/nope`)
    assert.equal(res.status, 404)
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/)
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(res.headers.get('x-powered-by'), null)
  })
})
