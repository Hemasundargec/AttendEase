import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { createMemoryUserRepo } from '../src/repos/memoryUserRepo.js'
import { createMemorySubjectRepo } from '../src/repos/memorySubjectRepo.js'
import { createMemoryAttendanceRepo } from '../src/repos/memoryAttendanceRepo.js'
import { createMemoryReminderLogRepo } from '../src/repos/memoryReminderLogRepo.js'
import { createMailer } from '../src/mailer.js'
import { dueSlot, indiaClock, needsReminder } from '../src/lib/reminders.js'
import { runReminderCheck, unsubscribeToken, readUnsubscribeToken } from '../src/reminderService.js'
import { hashPassword } from '../src/auth/password.js'

process.env.BCRYPT_COST = '4'
const SECRET = 'r'.repeat(40)
const at = (iso) => new Date(iso)
// Friday 23 Oct 2026: 17:00 India = 11:30 UTC, 20:00 = 14:30 UTC, 22:00 = 16:30 UTC
const FRI_5PM = at('2026-10-23T11:30:00Z'), FRI_8PM = at('2026-10-23T14:30:00Z'), FRI_10PM = at('2026-10-23T16:30:00Z')
const DATE = '2026-10-23'

// ---------- pure logic
test('India clock: converts UTC correctly, including across midnight', () => {
  assert.deepEqual(indiaClock(at('2026-10-23T11:30:00Z')), { date: '2026-10-23', hour: 17, minute: 0, weekday: 5 })
  assert.equal(indiaClock(at('2026-10-24T18:30:00Z')).date, '2026-10-25') // 00:00 next day in India
  assert.equal(indiaClock(at('2026-10-24T18:29:59Z')).date, '2026-10-24')
})

test('due slot: exact boundaries, grace window, Sundays', () => {
  assert.equal(dueSlot(at('2026-10-23T11:29:59Z')), null)       // 16:59:59
  assert.equal(dueSlot(FRI_5PM), '17:00')
  assert.equal(dueSlot(at('2026-10-23T12:00:00Z')), '17:00')   // 17:30, last minute of grace
  assert.equal(dueSlot(at('2026-10-23T12:01:00Z')), null)      // 17:31
  assert.equal(dueSlot(FRI_8PM), '20:00')
  assert.equal(dueSlot(FRI_10PM), '22:00')
  assert.equal(dueSlot(at('2026-10-23T17:01:00Z')), null)      // 22:31
  assert.equal(dueSlot(at('2026-10-25T11:30:00Z')), null)      // Sunday 17:00 is skipped
  assert.equal(dueSlot(at('2026-10-26T11:30:00Z')), '17:00')   // Monday is fine
})

test('needs reminder: none, partial, complete, zero-class days, no subjects', () => {
  assert.deepEqual(needsReminder({ subjectCount: 3, enteredCount: 0 }), { remind: true, reason: 'not_entered' })
  assert.deepEqual(needsReminder({ subjectCount: 3, enteredCount: 2 }), { remind: true, reason: 'partial' })
  assert.deepEqual(needsReminder({ subjectCount: 3, enteredCount: 3 }), { remind: false, reason: 'complete' })
  assert.deepEqual(needsReminder({ subjectCount: 0, enteredCount: 0 }), { remind: false, reason: 'no_subjects' })
})

// ---------- service
async function world(mailerOverride) {
  const users = createMemoryUserRepo(), subjects = createMemorySubjectRepo(), attendance = createMemoryAttendanceRepo(), logs = createMemoryReminderLogRepo()
  const outbox = []
  const mailer = mailerOverride || { mode: 'resend', async send(m) { outbox.push(m); return { accepted: true, mode: 'resend' } } }
  const ma = await subjects.create({ college: 'SRGEC', regulation: 'R23', branch: 'CSE', year: 2, semester: 3, code: 'MA1', name: 'Maths' })
  const ph = await subjects.create({ college: 'SRGEC', regulation: 'R23', branch: 'CSE', year: 2, semester: 3, code: 'PH1', name: 'Physics' })
  const mk = (roll, over = {}) => users.create({ name: `Stu ${roll}`, rollNumber: roll, college: 'SRGEC', regulation: 'R23', branch: 'CSE', year: 2, semester: 3, role: 'student', passwordHash: 'x', email: `${roll.toLowerCase()}@example.com`, emailVerified: true, remindersEnabled: true, ...over })
  const run = (now, extra = {}) => runReminderCheck({ users, subjects, attendance, logs, mailer, jwtSecret: SECRET, now, ...extra })
  return { users, subjects, attendance, logs, outbox, mk, run, ma, ph }
}

test('5 PM: reminds students with nothing entered, wording matches the situation', async () => {
  const w = await world()
  const none = await w.mk('S1'), partial = await w.mk('S2'), done = await w.mk('S3'), zero = await w.mk('S4')
  await w.attendance.upsertMany(partial.id, 3, DATE, [{ subjectId: w.ma.id, conducted: 1, attended: 1 }])
  await w.attendance.upsertMany(done.id, 3, DATE, [{ subjectId: w.ma.id, conducted: 2, attended: 2 }, { subjectId: w.ph.id, conducted: 2, attended: 1 }])
  await w.attendance.upsertMany(zero.id, 3, DATE, [{ subjectId: w.ma.id, conducted: 0, attended: 0 }, { subjectId: w.ph.id, conducted: 0, attended: 0 }]) // "no classes today"
  const r = await w.run(FRI_5PM)
  assert.equal(r.slot, '17:00'); assert.equal(r.sent, 2); assert.equal(r.skippedComplete, 2)
  const bySubject = Object.fromEntries(w.outbox.map((m) => [m.to, m.text]))
  assert.match(bySubject['s1@example.com'], /haven't entered today's attendance/)
  assert.match(bySubject['s2@example.com'], /entered 1 of 2 subjects/)
  assert.equal(bySubject['s3@example.com'], undefined); assert.equal(bySubject['s4@example.com'], undefined)
})

test('never sends the same slot twice, even when two checks run at once', async () => {
  const w = await world(); await w.mk('S1')
  const [a, b] = await Promise.all([w.run(FRI_5PM), w.run(FRI_5PM)])
  assert.equal(a.sent + b.sent, 1); assert.equal(a.duplicates + b.duplicates, 1)
  assert.equal((await w.run(FRI_5PM)).sent, 0)
  assert.equal(w.outbox.length, 1)
})

test('8 PM and 10 PM only if still unmarked; completing stops everything after', async () => {
  const w = await world(); const s = await w.mk('S1')
  assert.equal((await w.run(FRI_5PM)).sent, 1)
  assert.equal((await w.run(FRI_8PM)).sent, 1)                 // still unmarked
  await w.attendance.upsertMany(s.id, 3, DATE, [{ subjectId: w.ma.id, conducted: 1, attended: 1 }, { subjectId: w.ph.id, conducted: 1, attended: 0 }])
  const late = await w.run(FRI_10PM)
  assert.equal(late.sent, 0); assert.equal(late.skippedComplete, 1)
  assert.equal(w.outbox.length, 2)
})

test('quiet when it should be: outside a slot, Sunday, wrong settings, other roles', async () => {
  const w = await world()
  await w.mk('OFF', { remindersEnabled: false }); await w.mk('UNVER', { emailVerified: false }); await w.mk('NOMAIL', { email: null })
  await w.users.create({ name: 'Admin', rollNumber: 'ADM', college: 'SRGEC', role: 'admin', passwordHash: 'x', email: 'a@example.com', emailVerified: true, remindersEnabled: true })
  const s = await w.mk('LONE')
  assert.equal((await w.run(at('2026-10-23T09:00:00Z'))).sent, 0)   // 14:30, no slot
  assert.equal((await w.run(at('2026-10-25T11:30:00Z'))).sent, 0)   // Sunday
  const ok = await w.run(FRI_5PM)
  assert.equal(ok.considered, 1); assert.equal(ok.sent, 1)
  assert.deepEqual(w.outbox.map((m) => m.to), ['lone@example.com'])
  void s
})

test('a student with no subjects is skipped, and a restart shortly after a slot still catches up once', async () => {
  const w = await world()
  await w.mk('NOSUB', { branch: 'ECE' })                              // no ECE subjects exist
  const r = await w.run(at('2026-10-23T11:50:00Z'))                  // 17:20, within the grace window
  assert.equal(r.slot, '17:00'); assert.equal(r.sent, 0); assert.equal(r.skippedOther, 1)
  await w.mk('S1')
  assert.equal((await w.run(at('2026-10-23T11:50:00Z'))).sent, 1)
  assert.equal((await w.run(at('2026-10-23T11:51:00Z'))).sent, 0)
})

test('delivery is reported honestly: failures are logged as failed, no provider is "not sent", never "sent"', async () => {
  const failing = await world({ mode: 'resend', async send() { return { accepted: false, mode: 'resend', error: 'provider responded 500' } } })
  await failing.mk('S1')
  const f = await failing.run(FRI_5PM)
  assert.deepEqual([f.sent, f.failed], [0, 1])
  assert.deepEqual((await failing.logs.list()).map((l) => [l.status, l.detail]), [['failed', 'provider responded 500']])
  assert.equal((await failing.run(FRI_5PM)).failed, 0) // no hammering the same slot

  const quiet = await world(createMailer({ logger: { log() {} } }))   // log mode: no provider configured
  await quiet.mk('S1')
  const q = await quiet.run(FRI_5PM)
  assert.deepEqual([q.sent, q.notDelivered], [0, 1])
  assert.equal((await quiet.logs.list())[0].status, 'not_sent_no_provider')
})

test('reminder email: first name, unsubscribe link only when a site URL is known, link works', async () => {
  const w = await world(); const s = await w.mk('S1')
  await w.run(FRI_5PM, { siteUrl: 'https://attendease.example/' })
  const link = w.outbox[0].text.match(/https:\/\/attendease\.example\/api\/reminders\/unsubscribe\?token=([^\s]+)/)
  assert.ok(link); assert.match(w.outbox[0].text, /^Hi Stu,/)
  assert.equal(readUnsubscribeToken(SECRET, decodeURIComponent(link[1])), s.id)
  assert.equal(readUnsubscribeToken(SECRET, 'junk'), null)
  assert.equal(readUnsubscribeToken('other-secret-0123456789abcdef0123', unsubscribeToken(SECRET, s.id)), null)
  const w2 = await world(); await w2.mk('S1'); await w2.run(FRI_5PM)
  assert.doesNotMatch(w2.outbox[0].text, /unsubscribe\?token/); assert.match(w2.outbox[0].text, /Profile/)
})

// ---------- mailer
test('mailer: provider success, provider error and network failure; log mode never claims delivery', async () => {
  const msg = { to: 'a@b.co', subject: 's', text: 't' }
  let seen
  const okMailer = createMailer({ apiKey: 'k', from: 'f', fetchImpl: async (url, init) => { seen = { url, init }; return { ok: true, status: 200 } } })
  assert.deepEqual(await okMailer.send(msg), { accepted: true, mode: 'resend' })
  assert.equal(seen.init.headers.Authorization, 'Bearer k'); assert.deepEqual(JSON.parse(seen.init.body).to, ['a@b.co'])
  const bad = await createMailer({ apiKey: 'k', from: 'f', fetchImpl: async () => ({ ok: false, status: 422 }) }).send(msg)
  assert.deepEqual([bad.accepted, bad.error], [false, 'provider responded 422'])
  const down = await createMailer({ apiKey: 'k', from: 'f', fetchImpl: async () => { throw new Error('offline') } }).send(msg)
  assert.deepEqual([down.accepted, down.error], [false, 'offline'])
  const lines = []
  const log = await createMailer({ logger: { log: (x) => lines.push(x) } }).send(msg)
  assert.equal(log.accepted, false); assert.equal(log.mode, 'log'); assert.match(lines[0], /mail not sent/)
  assert.equal(createMailer({ apiKey: 'k' }).mode, 'log') // key without a sender address is not enough
})

// ---------- API: verification, switch, unsubscribe
async function withServer(fn, { mailer, emailLimit } = {}) {
  const users = createMemoryUserRepo(), subjects = createMemorySubjectRepo(), attendance = createMemoryAttendanceRepo()
  const sent = []
  const m = mailer || { mode: 'resend', async send(x) { sent.push(x); return { accepted: true, mode: 'resend' } } }
  const clock = { t: new Date('2026-10-23T06:00:00Z').getTime() }
  const app = createApp({ storage: { kind: 'memory' }, users, subjects, attendance, mailer: m, emailLimit, now: () => new Date(clock.t), jwtSecret: SECRET, formSecret: 'f' })
  const server = app.listen(0)
  const base = `http://127.0.0.1:${server.address().port}`
  const call = (path, { method = 'GET', body, cookie } = {}) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const ck = (res) => res.headers.getSetCookie().find((c) => c.startsWith('attendease_session=')).split(';')[0]
  const reg = async (roll) => ck(await call('/api/auth/register', { method: 'POST', body: { name: 'Stu ' + roll, rollNumber: roll, college: 'SRGEC', regulation: 'R23', branch: 'CSE', year: 2, semester: 3, password: 'Sunrise2026', confirmPassword: 'Sunrise2026' } }))
  await users.create({ name: 'Admin', rollNumber: 'ADMIN01', college: 'SRGEC', role: 'admin', passwordHash: await hashPassword('Adminpass2026') })
  const adminCookie = ck(await call('/api/auth/login', { method: 'POST', body: { rollNumber: 'ADMIN01', password: 'Adminpass2026' } }))
  const lastCode = () => sent.at(-1)?.text.match(/code is (\d{6})/)?.[1]
  try { await fn({ call, reg, adminCookie, sent, lastCode, clock, users }) } finally { server.close() }
}

test('email verification: code sent, never returned to the browser, right code turns reminders on', async () => {
  await withServer(async ({ call, reg, sent, lastCode, users }) => {
    const c = await reg('23A91A0501')
    assert.equal((await (await call('/api/student/reminders', { cookie: c })).json()).enabled, false)
    assert.equal((await call('/api/student/email', { method: 'POST', cookie: c, body: { email: 'not-an-email' } })).status, 400)
    const res = await call('/api/student/email', { method: 'POST', cookie: c, body: { email: ' Asha@Example.com ' } })
    const body = await res.json()
    assert.equal(res.status, 200); assert.equal(body.sent, true)
    assert.equal(JSON.stringify(body).includes(lastCode()), false)   // the code only goes to the inbox
    assert.equal(sent[0].to, 'asha@example.com')
    assert.equal((await call('/api/student/email/verify', { method: 'POST', cookie: c, body: { code: '000000' } })).status, 400)
    assert.equal((await call('/api/student/email/verify', { method: 'POST', cookie: c, body: { code: 'abcdef' } })).status, 400)
    assert.equal((await call('/api/student/email/verify', { method: 'POST', cookie: c, body: { code: lastCode() } })).status, 200)
    const state = await (await call('/api/student/reminders', { cookie: c })).json()
    assert.deepEqual([state.enabled, state.emailVerified, state.email], [true, true, 'a***@example.com'])
    assert.deepEqual(state.schedule, ['17:00', '20:00', '22:00'])
    const stored = await users.findByRoll('SRGEC', '23A91A0501')
    assert.equal(stored.codeHash, null)                              // challenge cleared after use
  })
})

test('email verification: codes expire, five wrong guesses lock the code, a new code resets it', async () => {
  await withServer(async ({ call, reg, lastCode, clock }) => {
    const c = await reg('23A91A0501')
    const ask = () => call('/api/student/email', { method: 'POST', cookie: c, body: { email: 'a@example.com' } })
    const verify = (code) => call('/api/student/email/verify', { method: 'POST', cookie: c, body: { code } })
    await ask(); const first = lastCode()
    clock.t += 16 * 60_000
    assert.equal((await verify(first)).status, 400)                  // expired
    await ask(); const second = lastCode()
    const wrong = second === '111111' ? '222222' : '111111'
    for (let i = 0; i < 5; i++) assert.equal((await verify(wrong)).status, 400)
    assert.equal((await verify(second)).status, 429)                 // locked even with the right code
    await ask()
    assert.equal((await verify(lastCode())).status, 200)             // fresh code works
  })
})

test('no code, no verifying; switch needs a verified email; removing the email turns reminders off', async () => {
  await withServer(async ({ call, reg, lastCode }) => {
    const c = await reg('23A91A0501')
    assert.equal((await call('/api/student/email/verify', { method: 'POST', cookie: c, body: { code: '123456' } })).status, 400)
    assert.equal((await call('/api/student/reminders', { method: 'PUT', cookie: c, body: { enabled: true } })).status, 400)
    assert.equal((await call('/api/student/reminders', { method: 'PUT', cookie: c, body: { enabled: 'yes' } })).status, 400)
    await call('/api/student/email', { method: 'POST', cookie: c, body: { email: 'a@example.com' } })
    await call('/api/student/email/verify', { method: 'POST', cookie: c, body: { code: lastCode() } })
    await call('/api/student/reminders', { method: 'PUT', cookie: c, body: { enabled: false } })
    assert.equal((await (await call('/api/student/reminders', { cookie: c })).json()).enabled, false)
    await call('/api/student/reminders', { method: 'PUT', cookie: c, body: { enabled: true } })
    assert.equal((await (await call('/api/student/reminders', { cookie: c })).json()).enabled, true)
    await call('/api/student/email', { method: 'DELETE', cookie: c })
    const after = await (await call('/api/student/reminders', { cookie: c })).json()
    assert.deepEqual([after.enabled, after.emailVerified, after.email], [false, false, null])
  })
})

test('with no email provider the server says so and does not pretend a code was sent', async () => {
  await withServer(async ({ call, reg }) => {
    const c = await reg('23A91A0501')
    const res = await call('/api/student/email', { method: 'POST', cookie: c, body: { email: 'a@example.com' } })
    const body = await res.json()
    assert.equal(body.sent, false); assert.match(body.message, /no email was sent/)
    assert.equal((await (await call('/api/student/reminders', { cookie: c })).json()).emailDelivery, 'not_configured')
  }, { mailer: createMailer({ logger: { log() {} } }) })
})

test('provider failure gives a 502 with a retry message; code requests are rate limited', async () => {
  await withServer(async ({ call, reg }) => {
    const c = await reg('23A91A0501')
    const res = await call('/api/student/email', { method: 'POST', cookie: c, body: { email: 'a@example.com' } })
    assert.equal(res.status, 502); assert.equal((await res.json()).sent, false)
  }, { mailer: { mode: 'resend', async send() { return { accepted: false, mode: 'resend', error: 'x' } } } })
  await withServer(async ({ call, reg }) => {
    const c = await reg('23A91A0501'), d = await reg('23A91A0502')
    const ask = (cookie) => call('/api/student/email', { method: 'POST', cookie, body: { email: 'a@example.com' } })
    assert.equal((await ask(c)).status, 200); assert.equal((await ask(c)).status, 200)
    assert.equal((await ask(c)).status, 429)
    assert.equal((await ask(d)).status, 200)                         // limit is per student, not shared
  }, { emailLimit: { windowMs: 60_000, max: 2 } })
})

test('unsubscribe link turns reminders off for that student only; bad links change nothing', async () => {
  await withServer(async ({ call, reg, lastCode, users }) => {
    const a = await reg('23A91A0501'), b = await reg('23A91A0502')
    for (const [c, e] of [[a, 'a@example.com'], [b, 'b@example.com']]) {
      await call('/api/student/email', { method: 'POST', cookie: c, body: { email: e } })
      await call('/api/student/email/verify', { method: 'POST', cookie: c, body: { code: lastCode() } })
    }
    const ua = await users.findByRoll('SRGEC', '23A91A0501')
    assert.equal((await call('/api/reminders/unsubscribe?token=junk')).status, 400)
    assert.equal((await call('/api/reminders/unsubscribe')).status, 400)
    assert.equal((await users.findByRoll('SRGEC', '23A91A0501')).remindersEnabled, true)
    const ok = await call(`/api/reminders/unsubscribe?token=${encodeURIComponent(unsubscribeToken(SECRET, ua.id))}`)
    assert.equal(ok.status, 200); assert.match(await ok.text(), /Reminders turned off/)
    assert.equal((await users.findByRoll('SRGEC', '23A91A0501')).remindersEnabled, false)
    assert.equal((await users.findByRoll('SRGEC', '23A91A0502')).remindersEnabled, true)
  })
})

test('reminder settings need a student login', async () => {
  await withServer(async ({ call, adminCookie }) => {
    assert.equal((await call('/api/student/reminders')).status, 401)
    assert.equal((await call('/api/student/reminders', { cookie: adminCookie })).status, 403)
    assert.equal((await call('/api/student/email', { method: 'POST', body: { email: 'a@b.co' } })).status, 401)
  })
})
