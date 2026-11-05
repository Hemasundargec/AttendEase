import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { createMemoryUserRepo } from '../src/repos/memoryUserRepo.js'
import { createMemorySubjectRepo } from '../src/repos/memorySubjectRepo.js'
import { createMemoryAttendanceRepo } from '../src/repos/memoryAttendanceRepo.js'
import { createMemoryTodoRepo } from '../src/repos/memoryTodoRepo.js'
import { createMemoryTimetableRepo } from '../src/repos/memoryTimetableRepo.js'

process.env.BCRYPT_COST = '4'
const NOW = new Date('2026-10-26T05:00:00Z') // a Monday in India
const MONDAY = '2026-10-26'

async function withServer(fn) {
  const users = createMemoryUserRepo(), subjects = createMemorySubjectRepo()
  const app = createApp({ storage: { kind: 'memory' }, users, subjects, attendance: createMemoryAttendanceRepo(), todos: createMemoryTodoRepo(), timetable: createMemoryTimetableRepo(), now: () => NOW, jwtSecret: 'x'.repeat(40), formSecret: 'f' })
  const server = app.listen(0)
  const base = `http://127.0.0.1:${server.address().port}`
  const call = (path, { method = 'GET', body, cookie } = {}) =>
    fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const reg = async (roll) => call('/api/auth/register', { method: 'POST', body: { name: 'Stu ' + roll, rollNumber: roll, college: 'SRGEC', regulation: 'R23', branch: 'CSE', year: 2, semester: 3, password: 'Sunrise2026', confirmPassword: 'Sunrise2026' } })
    .then((r) => r.headers.getSetCookie().find((c) => c.startsWith('attendease_session=')).split(';')[0])
  try { await fn({ call, reg, subjects }) } finally { server.close() }
}
const j = (r) => r.json()

test('a student adds their own subjects; code is optional and made up from the name', async () => {
  await withServer(async ({ call, reg }) => {
    const c = await reg('23A91A0601')
    const a = await call('/api/student/my-subjects', { method: 'POST', cookie: c, body: { name: ' Data   Structures ' } })
    assert.equal(a.status, 201)
    const { subject } = await j(a)
    assert.equal(subject.name, 'Data Structures'); assert.equal(subject.code, 'DS')
    const b = await j(await call('/api/student/my-subjects', { method: 'POST', cookie: c, body: { name: 'Discrete Systems' } }))
    assert.equal(b.subject.code, 'DS2') // same initials, so a number is added
    const own = await call('/api/student/my-subjects', { method: 'POST', cookie: c, body: { name: 'Physics', code: 'ph1' } })
    assert.equal((await j(own)).subject.code, 'PH1')
    assert.equal((await call('/api/student/my-subjects', { method: 'POST', cookie: c, body: { name: 'Other', code: 'PH1' } })).status, 409)
    assert.equal((await call('/api/student/my-subjects', { method: 'POST', cookie: c, body: { name: '  ' } })).status, 400)
    const list = (await j(await call('/api/student/subjects', { cookie: c }))).subjects
    assert.equal(list.length, 3); assert.ok(list.every((s) => s.mine))
  })
})

test('subjects are private: another student never sees them; admin list excludes them; same code allowed for two students', async () => {
  await withServer(async ({ call, reg, subjects }) => {
    const c1 = await reg('23A91A0602'), c2 = await reg('23A91A0603')
    const mine = (await j(await call('/api/student/my-subjects', { method: 'POST', cookie: c1, body: { name: 'Maths', code: 'M1' } }))).subject
    assert.equal((await j(await call('/api/student/subjects', { cookie: c2 }))).subjects.length, 0)
    assert.equal((await call('/api/student/my-subjects', { method: 'POST', cookie: c2, body: { name: 'Maths', code: 'M1' } })).status, 201)
    assert.equal((await call(`/api/student/my-subjects/${mine.id}`, { method: 'DELETE', cookie: c2 })).status, 404) // not theirs
    assert.equal((await subjects.list({})).length, 0)
  })
})

test('timetable: save per weekday, only own subjects, repeats allowed, reflected on the day view', async () => {
  await withServer(async ({ call, reg }) => {
    const c = await reg('23A91A0604'), other = await reg('23A91A0605')
    const m = (await j(await call('/api/student/my-subjects', { method: 'POST', cookie: c, body: { name: 'Maths' } }))).subject
    const p = (await j(await call('/api/student/my-subjects', { method: 'POST', cookie: c, body: { name: 'Physics' } }))).subject
    const foreign = (await j(await call('/api/student/my-subjects', { method: 'POST', cookie: other, body: { name: 'Chem' } }))).subject

    assert.equal((await call('/api/student/timetable', { method: 'PUT', cookie: c, body: { days: { 1: [m.id, foreign.id] } } })).status, 400)
    assert.equal((await call('/api/student/timetable', { method: 'PUT', cookie: c, body: { days: { 9: [m.id] } } })).status, 400)
    assert.equal((await call('/api/student/timetable', { method: 'PUT', cookie: c, body: { days: { 1: Array(11).fill(m.id) } } })).status, 400)
    const saved = await call('/api/student/timetable', { method: 'PUT', cookie: c, body: { days: { 1: [m.id, p.id, m.id], 2: [p.id] } } })
    assert.equal(saved.status, 200)
    const got = await j(await call('/api/student/timetable', { cookie: c }))
    assert.deepEqual(got.days['1'], [m.id, p.id, m.id]); assert.deepEqual(got.days['3'], [])
    const day = await j(await call(`/api/student/attendance/day/${MONDAY}`, { cookie: c }))
    assert.deepEqual(day.periods, [m.id, p.id, m.id])
    const tue = await j(await call('/api/student/attendance/day/2026-10-20', { cookie: c }))
    assert.deepEqual(tue.periods, [p.id])
    const none = await j(await call(`/api/student/attendance/day/${MONDAY}`, { cookie: other }))
    assert.deepEqual(none.periods, [])
  })
})

test('ticks become counts: 2 Maths periods, both held, one attended -> 2 conducted, 1 attended', async () => {
  await withServer(async ({ call, reg }) => {
    const c = await reg('23A91A0606')
    const m = (await j(await call('/api/student/my-subjects', { method: 'POST', cookie: c, body: { name: 'Maths' } }))).subject
    const p = (await j(await call('/api/student/my-subjects', { method: 'POST', cookie: c, body: { name: 'Physics' } }))).subject
    await call('/api/student/timetable', { method: 'PUT', cookie: c, body: { days: { 1: [m.id, p.id, m.id] } } })
    const put = await call(`/api/student/attendance/day/${MONDAY}`, { method: 'PUT', cookie: c, body: { entries: [{ subjectId: m.id, conducted: 2, attended: 1 }, { subjectId: p.id, conducted: 0, attended: 0 }] } })
    assert.equal(put.status, 200)
    const sum = await j(await call('/api/student/attendance/summary', { cookie: c }))
    assert.equal(sum.overall.attended, 1); assert.equal(sum.overall.conducted, 2)
  })
})

test('removing a subject hides it and clears it from the timetable but keeps saved attendance', async () => {
  await withServer(async ({ call, reg }) => {
    const c = await reg('23A91A0607')
    const m = (await j(await call('/api/student/my-subjects', { method: 'POST', cookie: c, body: { name: 'Maths' } }))).subject
    const p = (await j(await call('/api/student/my-subjects', { method: 'POST', cookie: c, body: { name: 'Physics' } }))).subject
    await call('/api/student/timetable', { method: 'PUT', cookie: c, body: { days: { 1: [m.id, p.id] } } })
    await call(`/api/student/attendance/day/${MONDAY}`, { method: 'PUT', cookie: c, body: { entries: [{ subjectId: m.id, conducted: 1, attended: 1 }, { subjectId: p.id, conducted: 1, attended: 0 }] } })
    assert.equal((await call(`/api/student/my-subjects/${m.id}`, { method: 'DELETE', cookie: c })).status, 200)
    assert.deepEqual((await j(await call('/api/student/timetable', { cookie: c }))).days['1'], [p.id])
    assert.deepEqual((await j(await call('/api/student/subjects', { cookie: c }))).subjects.map((s) => s.id), [p.id])
  })
})

test('limits: at most 15 own subjects per semester; logged-out access refused', async () => {
  await withServer(async ({ call, reg }) => {
    assert.equal((await call('/api/student/timetable')).status, 401)
    const c = await reg('23A91A0608')
    for (let i = 0; i < 15; i++) assert.equal((await call('/api/student/my-subjects', { method: 'POST', cookie: c, body: { name: 'Sub ' + i, code: 'S' + i } })).status, 201)
    assert.equal((await call('/api/student/my-subjects', { method: 'POST', cookie: c, body: { name: 'One too many', code: 'X1' } })).status, 400)
  })
})
