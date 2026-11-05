import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { createMemoryUserRepo } from '../src/repos/memoryUserRepo.js'
import { createMemorySubjectRepo } from '../src/repos/memorySubjectRepo.js'
import { createMemoryAttendanceRepo } from '../src/repos/memoryAttendanceRepo.js'
import { hashPassword } from '../src/auth/password.js'

process.env.BCRYPT_COST = '4'
const NOW = new Date('2026-10-25T05:00:00Z') // 10:30 on Sunday 25 Oct 2026 in India
const TODAY = '2026-10-25'

async function withServer(fn) {
  const users = createMemoryUserRepo(), subjects = createMemorySubjectRepo(), attendance = createMemoryAttendanceRepo()
  const app = createApp({ storage: { kind: 'memory' }, users, subjects, attendance, now: () => NOW, jwtSecret: 'x'.repeat(40), formSecret: 'f' })
  const server = app.listen(0)
  const base = `http://127.0.0.1:${server.address().port}`
  const call = (path, { method = 'GET', body, cookie } = {}) =>
    fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const ck = (res) => res.headers.getSetCookie().find((c) => c.startsWith('attendease_session=')).split(';')[0]
  const reg = async (roll, over = {}) => ck(await call('/api/auth/register', { method: 'POST', body: { name: 'Stu ' + roll, rollNumber: roll, college: 'SRGEC', regulation: 'R23', branch: 'CSE', year: 2, semester: 3, password: 'Sunrise2026', confirmPassword: 'Sunrise2026', ...over } }))
  await users.create({ name: 'Admin', rollNumber: 'ADMIN01', college: 'SRGEC', role: 'admin', passwordHash: await hashPassword('Adminpass2026') })
  const adminCookie = ck(await call('/api/auth/login', { method: 'POST', body: { rollNumber: 'ADMIN01', password: 'Adminpass2026' } }))
  const addSubject = (over = {}) => subjects.create({ college: 'SRGEC', regulation: 'R23', branch: 'CSE', year: 2, semester: 3, code: 'MA1', name: 'Mathematics', ...over })
  try { await fn({ call, reg, adminCookie, addSubject, subjects, attendance, users }) } finally { server.close() }
}
const put = (call, cookie, date, entries) => call(`/api/student/attendance/day/${date}`, { method: 'PUT', body: { entries }, cookie })

test('a student sees only active subjects for their own branch, year and semester', async () => {
  await withServer(async ({ call, reg, addSubject, subjects }) => {
    const mine = await addSubject({ code: 'MA1', name: 'Mathematics' })
    await addSubject({ code: 'PH1', name: 'Physics' })
    await addSubject({ code: 'EC1', name: 'Circuits', branch: 'ECE' })          // other branch
    await addSubject({ code: 'S4', name: 'Sem four', year: 2, semester: 4 })     // other semester
    const dead = await addSubject({ code: 'OLD', name: 'Retired' }); await subjects.update(dead.id, { active: false })
    const cookie = await reg('23A91A0501')
    const { subjects: list } = await (await call('/api/student/subjects', { cookie })).json()
    assert.deepEqual(list.map((s) => s.code), ['MA1', 'PH1'])
    assert.ok(list.some((s) => s.id === mine.id))
  })
})

test('all student routes need a login, and admins are not students', async () => {
  await withServer(async ({ call, adminCookie }) => {
    assert.equal((await call('/api/student/subjects')).status, 401)
    assert.equal((await call(`/api/student/attendance/summary`)).status, 401)
    assert.equal((await call('/api/student/subjects', { cookie: adminCookie })).status, 403)
  })
})

test('save, reload and correct a day without creating duplicates', async () => {
  await withServer(async ({ call, reg, addSubject, attendance }) => {
    const m = await addSubject({ code: 'MA1' }), p = await addSubject({ code: 'PH1', name: 'Physics' })
    const cookie = await reg('23A91A0501')
    const first = await put(call, cookie, TODAY, [{ subjectId: m.id, conducted: 2, attended: 2 }, { subjectId: p.id, conducted: 2, attended: 1 }])
    assert.equal(first.status, 200)
    assert.equal(await attendance.countAll(), 2)

    const day = await (await call(`/api/student/attendance/day/${TODAY}`, { cookie })).json()
    assert.equal(day.weekday, 'Sunday')
    assert.deepEqual(day.subjects.map((s) => [s.code, s.entered, s.conducted, s.attended]), [['MA1', true, 2, 2], ['PH1', true, 2, 1]])

    await put(call, cookie, TODAY, [{ subjectId: p.id, conducted: 3, attended: 3 }]) // correction
    assert.equal(await attendance.countAll(), 2) // still two rows
    const again = await (await call(`/api/student/attendance/day/${TODAY}`, { cookie })).json()
    assert.deepEqual(again.subjects.find((s) => s.code === 'PH1'), { id: p.id, code: 'PH1', name: 'Physics', entered: true, conducted: 3, attended: 3 })
    assert.equal(again.subjects.find((s) => s.code === 'MA1').attended, 2) // untouched subject kept
  })
})

test('"not entered yet" is different from "0 classes held"', async () => {
  await withServer(async ({ call, reg, addSubject }) => {
    const m = await addSubject({ code: 'MA1' }); await addSubject({ code: 'PH1', name: 'Physics' })
    const cookie = await reg('23A91A0501')
    await put(call, cookie, TODAY, [{ subjectId: m.id, conducted: 0, attended: 0 }])
    const day = await (await call(`/api/student/attendance/day/${TODAY}`, { cookie })).json()
    assert.deepEqual(day.subjects.map((s) => [s.code, s.entered, s.conducted]), [['MA1', true, 0], ['PH1', false, null]])
    const sum = await (await call('/api/student/attendance/summary', { cookie })).json()
    assert.equal(sum.today.state, 'partial')
    assert.equal(sum.overall.status, 'no_data') // zero classes held is not 0%
    assert.equal(sum.overall.percentage, null)
  })
})

test('server rejects bad numbers, even though the browser also checks', async () => {
  await withServer(async ({ call, reg, addSubject, attendance }) => {
    const m = await addSubject({ code: 'MA1' })
    const cookie = await reg('23A91A0501')
    const bad = [
      { conducted: 2, attended: 3 }, { conducted: -1, attended: 0 }, { conducted: 2.5, attended: 1 },
      { conducted: '2', attended: '1' }, { conducted: null, attended: null }, { conducted: 99, attended: 1 },
      { conducted: 1, attended: 0.5 }, {},
    ]
    for (const b of bad) {
      const res = await put(call, cookie, TODAY, [{ subjectId: m.id, ...b }])
      assert.equal(res.status, 400, JSON.stringify(b))
      assert.ok((await res.json()).rowErrors[m.id])
    }
    assert.equal(await attendance.countAll(), 0)
  })
})

test('server rejects unknown subjects, other branches\' subjects, duplicates and empty submissions', async () => {
  await withServer(async ({ call, reg, addSubject }) => {
    const m = await addSubject({ code: 'MA1' })
    const other = await addSubject({ code: 'EC1', branch: 'ECE' })
    const cookie = await reg('23A91A0501')
    assert.equal((await put(call, cookie, TODAY, [{ subjectId: other.id, conducted: 1, attended: 1 }])).status, 400)
    assert.equal((await put(call, cookie, TODAY, [{ subjectId: 'nope', conducted: 1, attended: 1 }])).status, 400)
    assert.equal((await put(call, cookie, TODAY, [{ subjectId: m.id, conducted: 1, attended: 1 }, { subjectId: m.id, conducted: 1, attended: 1 }])).status, 400)
    assert.equal((await put(call, cookie, TODAY, [])).status, 400)
    assert.equal((await call(`/api/student/attendance/day/${TODAY}`, { method: 'PUT', body: {}, cookie })).status, 400)
  })
})

test('dates: future, impossible and too-old dates are refused; yesterday is fine', async () => {
  await withServer(async ({ call, reg, addSubject }) => {
    const m = await addSubject({ code: 'MA1' })
    const cookie = await reg('23A91A0501')
    const row = [{ subjectId: m.id, conducted: 1, attended: 1 }]
    assert.equal((await put(call, cookie, '2026-10-26', row)).status, 400)  // tomorrow
    assert.equal((await put(call, cookie, '2026-02-30', row)).status, 400)  // not a date
    assert.equal((await put(call, cookie, 'banana', row)).status, 400)
    assert.equal((await put(call, cookie, '2026-04-01', row)).status, 400)  // > 180 days back
    assert.equal((await put(call, cookie, '2026-10-24', row)).status, 200)  // yesterday
    assert.equal((await call('/api/student/attendance/day/2026-10-30', { cookie })).status, 400) // cannot even open the future
  })
})

test('summary: totals, percentages, status thresholds and the 40% subject warning', async () => {
  await withServer(async ({ call, reg, addSubject }) => {
    const m = await addSubject({ code: 'MA1' }), p = await addSubject({ code: 'PH1', name: 'Physics' })
    const cookie = await reg('23A91A0501')
    await put(call, cookie, '2026-10-23', [{ subjectId: m.id, conducted: 10, attended: 10 }, { subjectId: p.id, conducted: 10, attended: 3 }])
    await put(call, cookie, '2026-10-24', [{ subjectId: m.id, conducted: 10, attended: 10 }, { subjectId: p.id, conducted: 10, attended: 4 }])
    const s = await (await call('/api/student/attendance/summary', { cookie })).json()
    assert.equal(s.overall.attended, 27); assert.equal(s.overall.conducted, 40); assert.equal(s.overall.percentage, 67.5)
    assert.equal(s.overall.status, 'condonation')               // 65 <= 67.5 < 75
    assert.deepEqual(s.subjectWarnings, ['PH1'])                // 7/20 = 35% < 40
    assert.equal(s.subjects.find((x) => x.code === 'MA1').status, 'safe')
    assert.equal(s.today.state, 'not_entered')
    assert.deepEqual(s.policy, { safePercent: 75, condonationPercent: 65, subjectMinPercent: 40 })
  })
})

test('prediction: aggregate and subject-minimum are reported separately', async () => {
  await withServer(async ({ call, reg, addSubject }) => {
    const m = await addSubject({ code: 'MA1' })
    const cookie = await reg('23A91A0501')
    await put(call, cookie, TODAY, [{ subjectId: m.id, conducted: 4, attended: 3 }]) // exactly 75%
    const r = await (await call('/api/student/attendance/predict?target=75', { cookie })).json()
    assert.deepEqual(r.overall.safeLeave, { available: true, belowTarget: false, canMiss: 0 })
    assert.equal(r.overall.recovery.mustAttend, 0)
    assert.equal(r.subjectMinimum.target, 40)
    const r90 = await (await call('/api/student/attendance/predict?target=90', { cookie })).json()
    assert.equal(r90.overall.recovery.mustAttend, 6) // (3+6)/(4+6) = 90%
    assert.equal((await call('/api/student/attendance/predict?target=abc', { cookie })).status, 400)
    assert.equal((await call('/api/student/attendance/predict?target=0', { cookie })).status, 400)
    assert.equal((await call('/api/student/attendance/predict?target=75.5', { cookie })).status, 400)
  })
})

test('privacy: students never see each other\'s records, and a user id in the request is ignored', async () => {
  await withServer(async ({ call, reg, addSubject, users }) => {
    const m = await addSubject({ code: 'MA1' })
    const a = await reg('23A91A0501'), b = await reg('23A91A0502')
    const aUser = await users.findByRoll('SRGEC', '23A91A0501')
    await put(call, a, TODAY, [{ subjectId: m.id, conducted: 5, attended: 5 }])
    // B tries to impersonate A through the body and the query string
    const res = await call(`/api/student/attendance/day/${TODAY}?userId=${aUser.id}`, { method: 'PUT', cookie: b, body: { userId: aUser.id, entries: [{ subjectId: m.id, conducted: 5, attended: 0 }] } })
    assert.equal(res.status, 200)
    const aSum = await (await call('/api/student/attendance/summary', { cookie: a })).json()
    const bSum = await (await call('/api/student/attendance/summary', { cookie: b })).json()
    assert.equal(aSum.overall.attended, 5)  // A unchanged
    assert.equal(bSum.overall.attended, 0); assert.equal(bSum.overall.conducted, 5)
    assert.equal((await (await call('/api/student/attendance/history', { cookie: a })).json()).entries.length, 1)
    assert.equal((await (await call('/api/student/attendance/history', { cookie: b })).json()).entries[0].attended, 0)
  })
})

test('semesters stay separate: old records are kept when the semester changes', async () => {
  await withServer(async ({ attendance }) => {
    await attendance.upsertMany('u1', 3, '2026-10-01', [{ subjectId: 's1', conducted: 2, attended: 2 }])
    await attendance.upsertMany('u1', 4, '2027-02-01', [{ subjectId: 's9', conducted: 3, attended: 1 }])
    assert.equal((await attendance.forSemester('u1', 3)).length, 1)
    assert.equal((await attendance.forSemester('u1', 4)).length, 1)
    assert.equal((await attendance.forSemester('u1', 3))[0].attended, 2) // untouched
    await attendance.upsertMany('u1', 3, '2026-10-01', [{ subjectId: 's1', conducted: 2, attended: 1 }])
    assert.equal((await attendance.forSemester('u1', 3)).length, 1) // replaced, not duplicated
  })
})

test('admin subject management: create, duplicate blocked, edit, deactivate; students are locked out', async () => {
  await withServer(async ({ call, reg, adminCookie }) => {
    const student = await reg('23A91A0501')
    const body = { code: 'ma101', name: ' Engineering  Mathematics ', college: 'SRGEC', regulation: 'R23', branch: 'CSE', year: 2, semester: 3 }
    assert.equal((await call('/api/admin/subjects', { method: 'POST', body, cookie: student })).status, 403)
    assert.equal((await call('/api/admin/subjects')).status, 401)

    const created = await call('/api/admin/subjects', { method: 'POST', body, cookie: adminCookie })
    assert.equal(created.status, 201)
    const { subject } = await created.json()
    assert.equal(subject.code, 'MA101'); assert.equal(subject.name, 'Engineering Mathematics')

    assert.equal((await call('/api/admin/subjects', { method: 'POST', body: { ...body, code: 'MA101' }, cookie: adminCookie })).status, 409)
    assert.equal((await call('/api/admin/subjects', { method: 'POST', body: { ...body, code: '!!', year: 9 }, cookie: adminCookie })).status, 400)

    const edited = await call(`/api/admin/subjects/${subject.id}`, { method: 'PATCH', body: { name: 'Maths I' }, cookie: adminCookie })
    assert.equal((await edited.json()).subject.name, 'Maths I')

    assert.equal((await (await call('/api/student/subjects', { cookie: student })).json()).subjects.length, 1)
    await call(`/api/admin/subjects/${subject.id}`, { method: 'PATCH', body: { active: false }, cookie: adminCookie })
    assert.equal((await (await call('/api/student/subjects', { cookie: student })).json()).subjects.length, 0)
    assert.equal((await call('/api/admin/subjects/does-not-exist', { method: 'PATCH', body: { name: 'x' }, cookie: adminCookie })).status, 404)
  })
})
