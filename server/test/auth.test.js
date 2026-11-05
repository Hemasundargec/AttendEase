import { test } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { createApp } from '../src/app.js'
import { createMemoryUserRepo } from '../src/repos/memoryUserRepo.js'
import { hashPassword } from '../src/auth/password.js'
import { validateRegistration, validatePassword } from '../src/validators/auth.js'

process.env.BCRYPT_COST = '4' // fast hashing for tests only
const JWT_SECRET = 'a-test-secret-that-is-long-enough-1234567890'

async function withServer(options, fn) {
  const users = createMemoryUserRepo()
  const app = createApp({ storage: { kind: 'memory' }, users, jwtSecret: JWT_SECRET, formSecret: 'f', ...options })
  const server = app.listen(0)
  const base = `http://127.0.0.1:${server.address().port}`
  try { await fn({ base, users }) } finally { server.close() }
}

const goodReg = (over = {}) => ({
  name: 'Asha Rao', rollNumber: '23a91a0501', college: 'SRGEC', regulation: 'R23', branch: 'CSE',
  year: 2, semester: 3, password: 'Sunrise2026', confirmPassword: 'Sunrise2026', ...over,
})
const json = (base, path, body, { cookie, method = 'POST', headers = {} } = {}) =>
  fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
const get = (base, path, cookie) => fetch(`${base}${path}`, { headers: cookie ? { Cookie: cookie } : {} })
const cookieOf = (res) => (res.headers.getSetCookie().find((c) => c.startsWith('attendease_session=')) || '')
const pair = (res) => cookieOf(res).split(';')[0]

// ---------- validation (pure)
test('registration validation: accepts good input and normalises roll number to uppercase', () => {
  const r = validateRegistration(goodReg())
  assert.equal(r.ok, true)
  assert.equal(r.value.rollNumber, '23A91A0501')
})

test('registration validation: reports every bad field', () => {
  const r = validateRegistration({ name: '', rollNumber: '!', college: 'X', regulation: 'Y', branch: 'Z', year: 9, semester: 1, password: 'short', confirmPassword: 'nope' })
  assert.deepEqual(Object.keys(r.fieldErrors).sort(), ['branch', 'college', 'name', 'password', 'regulation', 'rollNumber', 'year'])
})

test('registration validation: semester must belong to the year; passwords must match', () => {
  assert.ok(validateRegistration(goodReg({ year: 2, semester: 5 })).fieldErrors.semester)
  assert.ok(validateRegistration(goodReg({ year: 2, semester: 4 })).ok)
  assert.ok(validateRegistration(goodReg({ confirmPassword: 'Different2026' })).fieldErrors.confirmPassword)
})

test('password rules: length, letter+number, 72-byte cap, no roll number inside', () => {
  assert.ok(validatePassword('abc12'))
  assert.ok(validatePassword('onlyletters'))
  assert.ok(validatePassword('12345678'))
  assert.ok(validatePassword('a1' + 'x'.repeat(80)))
  assert.ok(validatePassword('my23A91A0501pw', { rollNumber: '23A91A0501' }))
  assert.equal(validatePassword('Sunrise2026'), null)
})

// ---------- registration
test('register: creates a student, hashes the password, sets a safe cookie, never returns the hash', async () => {
  await withServer({}, async ({ base, users }) => {
    const res = await json(base, '/api/auth/register', goodReg())
    assert.equal(res.status, 201)
    const body = await res.json()
    assert.equal(body.user.role, 'student')
    assert.equal(body.user.rollNumber, '23A91A0501')
    assert.equal(body.user.passwordHash, undefined)
    assert.equal(JSON.stringify(body).includes('Sunrise2026'), false)

    const stored = await users.findByRoll('SRGEC', '23A91A0501')
    assert.notEqual(stored.passwordHash, 'Sunrise2026')
    assert.match(stored.passwordHash, /^\$2[aby]\$04\$/) // bcrypt, cost 4 in tests

    const c = cookieOf(res)
    assert.match(c, /HttpOnly/i)
    assert.match(c, /SameSite=Lax/i)
    assert.doesNotMatch(c, /Secure/i) // not production
  })
})

test('register: cookie is Secure in production', async () => {
  await withServer({ isProduction: true }, async ({ base }) => {
    const res = await json(base, '/api/auth/register', goodReg(), { headers: { 'X-Forwarded-Proto': 'https' } })
    assert.equal(res.status, 201)
    assert.match(cookieOf(res), /Secure/i)
  })
})

test('register: duplicate roll number is rejected, even with different letter case', async () => {
  await withServer({}, async ({ base }) => {
    assert.equal((await json(base, '/api/auth/register', goodReg())).status, 201)
    const dup = await json(base, '/api/auth/register', goodReg({ rollNumber: '23A91A0501', name: 'Someone Else' }))
    assert.equal(dup.status, 409)
    assert.ok((await dup.json()).fieldErrors.rollNumber)
    const lower = await json(base, '/api/auth/register', goodReg({ rollNumber: '23a91a0501' }))
    assert.equal(lower.status, 409)
  })
})

test('register: a browser cannot make itself an admin', async () => {
  await withServer({}, async ({ base, users }) => {
    const res = await json(base, '/api/auth/register', { ...goodReg(), role: 'admin', isAdmin: true })
    assert.equal(res.status, 201)
    assert.equal((await res.json()).user.role, 'student')
    assert.equal((await users.findByRoll('SRGEC', '23A91A0501')).role, 'student')
  })
})

test('register: invalid input gets 400 with field errors and creates nothing', async () => {
  await withServer({}, async ({ base, users }) => {
    const res = await json(base, '/api/auth/register', goodReg({ password: 'weak' }))
    assert.equal(res.status, 400)
    assert.ok((await res.json()).fieldErrors.password)
    assert.equal(await users.countStudents(), 0)
  })
})

// ---------- login / session
test('login: success, then /me returns the right user without secrets', async () => {
  await withServer({}, async ({ base }) => {
    await json(base, '/api/auth/register', goodReg())
    const res = await json(base, '/api/auth/login', { rollNumber: ' 23a91a0501 ', password: 'Sunrise2026' })
    assert.equal(res.status, 200)
    const me = await get(base, '/api/auth/me', pair(res))
    assert.equal(me.status, 200)
    const { user } = await me.json()
    assert.equal(user.rollNumber, '23A91A0501')
    assert.equal(user.passwordHash, undefined)
    assert.equal(user.tokenVersion, undefined)
  })
})

test('login: wrong password and unknown roll number give the same generic 401', async () => {
  await withServer({}, async ({ base }) => {
    await json(base, '/api/auth/register', goodReg())
    const wrong = await json(base, '/api/auth/login', { rollNumber: '23A91A0501', password: 'Wrongpass1' })
    const unknown = await json(base, '/api/auth/login', { rollNumber: '99Z99Z9999', password: 'Wrongpass1' })
    assert.equal(wrong.status, 401)
    assert.equal(unknown.status, 401)
    assert.deepEqual(await wrong.json(), await unknown.json())
    assert.equal(cookieOf(wrong), '')
  })
})

test('login: malformed bodies are refused cleanly', async () => {
  await withServer({}, async ({ base }) => {
    assert.equal((await json(base, '/api/auth/login', { rollNumber: { $ne: '' }, password: { $ne: '' } })).status, 401)
    assert.equal((await json(base, '/api/auth/login', {})).status, 401)
  })
})

test('login: rate limited after too many attempts', async () => {
  await withServer({ loginLimit: { windowMs: 60_000, max: 3 } }, async ({ base }) => {
    for (let i = 0; i < 3; i++) await json(base, '/api/auth/login', { rollNumber: 'X12345', password: 'nope' })
    assert.equal((await json(base, '/api/auth/login', { rollNumber: 'X12345', password: 'nope' })).status, 429)
  })
})

test('protected routes: no cookie, garbage cookie and forged alg:none token are all 401', async () => {
  await withServer({}, async ({ base }) => {
    const reg = await json(base, '/api/auth/register', goodReg())
    const { user } = await reg.json()
    assert.equal((await get(base, '/api/auth/me')).status, 401)
    assert.equal((await get(base, '/api/auth/me', 'attendease_session=garbage')).status, 401)
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: user.id, tv: 0, role: 'admin' })).toString('base64url') + '.'
    assert.equal((await get(base, '/api/auth/me', `attendease_session=${none}`)).status, 401)
    const wrongKey = jwt.sign({ sub: user.id, tv: 0 }, 'some-other-secret-value-0123456789abcdef')
    assert.equal((await get(base, '/api/auth/me', `attendease_session=${wrongKey}`)).status, 401)
  })
})

test('logout: clears the cookie', async () => {
  await withServer({}, async ({ base }) => {
    const reg = await json(base, '/api/auth/register', goodReg())
    const res = await json(base, '/api/auth/logout', undefined, { cookie: pair(reg) })
    assert.equal(res.status, 200)
    assert.match(cookieOf(res), /attendease_session=;/)
  })
})

test('each student only ever sees their own account', async () => {
  await withServer({}, async ({ base }) => {
    const a = await json(base, '/api/auth/register', goodReg())
    const b = await json(base, '/api/auth/register', goodReg({ rollNumber: '23A91A0502', name: 'Ravi Kumar' }))
    assert.equal((await (await get(base, '/api/auth/me', pair(a))).json()).user.name, 'Asha Rao')
    assert.equal((await (await get(base, '/api/auth/me', pair(b))).json()).user.name, 'Ravi Kumar')
  })
})

// ---------- change password
test('change password: needs the current password, signs out old sessions, keeps this one', async () => {
  await withServer({}, async ({ base }) => {
    const first = await json(base, '/api/auth/register', goodReg())
    const oldCookie = pair(first)
    const bad = await json(base, '/api/auth/change-password', { currentPassword: 'Wrong1234', newPassword: 'Moonlight2027', confirmPassword: 'Moonlight2027' }, { cookie: oldCookie })
    assert.equal(bad.status, 400)

    const ok = await json(base, '/api/auth/change-password', { currentPassword: 'Sunrise2026', newPassword: 'Moonlight2027', confirmPassword: 'Moonlight2027' }, { cookie: oldCookie })
    assert.equal(ok.status, 200)
    assert.equal((await get(base, '/api/auth/me', oldCookie)).status, 401) // old session dead
    assert.equal((await get(base, '/api/auth/me', pair(ok))).status, 200) // fresh cookie works
    assert.equal((await json(base, '/api/auth/login', { rollNumber: '23A91A0501', password: 'Sunrise2026' })).status, 401)
    assert.equal((await json(base, '/api/auth/login', { rollNumber: '23A91A0501', password: 'Moonlight2027' })).status, 200)
  })
})

// ---------- admin only
test('admin overview: 401 anonymous, 403 student, 200 admin', async () => {
  await withServer({}, async ({ base, users }) => {
    const student = await json(base, '/api/auth/register', goodReg())
    await users.create({ name: 'Admin', rollNumber: 'ADMIN01', college: 'SRGEC', role: 'admin', passwordHash: await hashPassword('Adminpass2026') })

    assert.equal((await get(base, '/api/admin/overview')).status, 401)
    assert.equal((await get(base, '/api/admin/overview', pair(student))).status, 403)

    const login = await json(base, '/api/auth/login', { rollNumber: 'admin01', password: 'Adminpass2026' })
    assert.equal(login.status, 200)
    const overview = await get(base, '/api/admin/overview', pair(login))
    assert.equal(overview.status, 200)
    const data = await overview.json()
    assert.equal(data.totalStudents, 1)
    assert.deepEqual(data.byBranchAndSemester, [{ branch: 'CSE', semester: 3, count: 1 }])
  })
})

test('a student cannot become admin by forging a token role claim', async () => {
  await withServer({}, async ({ base }) => {
    const reg = await json(base, '/api/auth/register', goodReg())
    const { user } = await reg.json()
    const forged = jwt.sign({ sub: user.id, tv: 0, role: 'admin' }, JWT_SECRET) // even with the real key
    assert.equal((await get(base, '/api/admin/overview', `attendease_session=${forged}`)).status, 403) // role comes from the database
  })
})

// ---------- CSRF origin guard + public options
test('state-changing request from a foreign Origin is blocked; same origin is fine', async () => {
  await withServer({}, async ({ base }) => {
    const evil = await json(base, '/api/auth/login', { rollNumber: 'A', password: 'b' }, { headers: { Origin: 'https://evil.example' } })
    assert.equal(evil.status, 403)
    const same = await json(base, '/api/auth/login', { rollNumber: 'A', password: 'b' }, { headers: { Origin: base } })
    assert.equal(same.status, 401)
  })
})

test('academic options are public and list SRGEC and R23', async () => {
  await withServer({}, async ({ base }) => {
    const data = await (await get(base, '/api/meta/academic-options')).json()
    assert.equal(data.colleges[0].id, 'SRGEC')
    assert.equal(data.regulations[0].id, 'R23')
    assert.deepEqual(data.semestersByYear['2'], [3, 4])
  })
})

test('dev: Vite-proxied login (loopback Origin on another port) is allowed; foreign origin still blocked', async () => {
  await withServer({}, async ({ base }) => {
    const h = (o, extra = {}) => ({ headers: { Origin: o, ...extra } })
    const dev = await json(base, '/api/auth/login', { rollNumber: 'A', password: 'b' }, h('http://localhost:5173'))
    assert.equal(dev.status, 401)
    const dev2 = await json(base, '/api/auth/login', { rollNumber: 'A', password: 'b' }, h('http://127.0.0.1:5173'))
    assert.equal(dev2.status, 401)
    const evil = await json(base, '/api/auth/login', { rollNumber: 'A', password: 'b' }, h('https://evil.example'))
    assert.equal(evil.status, 403)
  })
})

test('production: loopback origin is NOT trusted, but X-Forwarded-Host and ALLOWED_ORIGINS are', async () => {
  await withServer({ isProduction: true, allowedOrigins: ['https://app.example'], canonicalHost: '127.0.0.1' }, async ({ base }) => {
    const body = { rollNumber: 'A', password: 'b' }
    const loop = await json(base, '/api/auth/login', body, { headers: { Origin: 'http://localhost:5173', 'X-Forwarded-Proto': 'https' } })
    assert.equal(loop.status, 403)
    const fwd = await json(base, '/api/auth/login', body, { headers: { Origin: 'https://site.example', 'X-Forwarded-Host': 'site.example', 'X-Forwarded-Proto': 'https' } })
    assert.notEqual(fwd.status, 403)
    const allowed = await json(base, '/api/auth/login', body, { headers: { Origin: 'https://app.example', 'X-Forwarded-Proto': 'https' } })
    assert.notEqual(allowed.status, 403)
  })
})
