import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.js'
import { createMemoryUserRepo } from '../src/repos/memoryUserRepo.js'
import { createMemorySubjectRepo } from '../src/repos/memorySubjectRepo.js'
import { createMemoryAttendanceRepo } from '../src/repos/memoryAttendanceRepo.js'
import { createMemoryTodoRepo } from '../src/repos/memoryTodoRepo.js'
import { hashPassword } from '../src/auth/password.js'
import { statistics } from '../src/lib/attendance.js'

process.env.BCRYPT_COST = '4'
const NOW = new Date('2026-10-25T05:00:00Z')

async function withServer(fn) {
  const users = createMemoryUserRepo(), subjects = createMemorySubjectRepo(), attendance = createMemoryAttendanceRepo(), todos = createMemoryTodoRepo()
  const app = createApp({ storage: { kind: 'memory' }, users, subjects, attendance, todos, now: () => NOW, jwtSecret: 'x'.repeat(40), formSecret: 'f' })
  const server = app.listen(0)
  const base = `http://127.0.0.1:${server.address().port}`
  const call = (path, { method = 'GET', body, cookie } = {}) =>
    fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const ck = (res) => res.headers.getSetCookie().find((c) => c.startsWith('attendease_session=')).split(';')[0]
  const reg = async (roll, over = {}) => ck(await call('/api/auth/register', { method: 'POST', body: { name: 'Stu ' + roll, rollNumber: roll, college: 'SRGEC', regulation: 'R23', branch: 'CSE', year: 2, semester: 3, password: 'Sunrise2026', confirmPassword: 'Sunrise2026', ...over } }))
  await users.create({ name: 'Admin', rollNumber: 'ADMIN01', college: 'SRGEC', role: 'admin', passwordHash: await hashPassword('Adminpass2026') })
  const adminCookie = ck(await call('/api/auth/login', { method: 'POST', body: { rollNumber: 'ADMIN01', password: 'Adminpass2026' } }))
  const addSubject = (over = {}) => subjects.create({ college: 'SRGEC', regulation: 'R23', branch: 'CSE', year: 2, semester: 3, code: 'MA1', name: 'Mathematics', ...over })
  try { await fn({ call, reg, adminCookie, addSubject, subjects, attendance, users, todos }) } finally { server.close() }
}
const j = async (res) => res.json()

// ---------------- to-do list
test('todos: add, list, edit, complete, reopen, delete', async () => {
  await withServer(async ({ call, reg }) => {
    const c = await reg('23A91A0501')
    const made = await call('/api/student/todos', { method: 'POST', cookie: c, body: { title: '  Submit   Python assignment ', dueDate: '2026-10-30', priority: 'high', description: 'Unit 3' } })
    assert.equal(made.status, 201)
    const { todo } = await j(made)
    assert.equal(todo.title, 'Submit Python assignment'); assert.equal(todo.priority, 'high'); assert.equal(todo.completed, false)

    await call('/api/student/todos', { method: 'POST', cookie: c, body: { title: 'Lab record' } }) // defaults: medium, no due date
    assert.equal((await j(await call('/api/student/todos', { cookie: c }))).todos.length, 2)

    const done = await j(await call(`/api/student/todos/${todo.id}`, { method: 'PATCH', cookie: c, body: { completed: true } }))
    assert.equal(done.todo.completed, true); assert.ok(done.todo.completedAt)
    assert.equal((await j(await call('/api/student/todos?status=pending', { cookie: c }))).todos.length, 1)
    assert.equal((await j(await call('/api/student/todos?status=completed', { cookie: c }))).todos.length, 1)

    const edited = await j(await call(`/api/student/todos/${todo.id}`, { method: 'PATCH', cookie: c, body: { title: 'Python assignment 2', dueDate: null, completed: false } }))
    assert.equal(edited.todo.title, 'Python assignment 2'); assert.equal(edited.todo.dueDate, null); assert.equal(edited.todo.completedAt, null)

    assert.equal((await call(`/api/student/todos/${todo.id}`, { method: 'DELETE', cookie: c })).status, 200)
    assert.equal((await j(await call('/api/student/todos', { cookie: c }))).todos.length, 1)
    assert.equal((await call(`/api/student/todos/${todo.id}`, { method: 'DELETE', cookie: c })).status, 404)
  })
})

test('todos: validation rejects bad input; new tasks cannot start completed', async () => {
  await withServer(async ({ call, reg }) => {
    const c = await reg('23A91A0501')
    const post = (body) => call('/api/student/todos', { method: 'POST', cookie: c, body })
    for (const bad of [{}, { title: '   ' }, { title: 'x'.repeat(121) }, { title: { a: 1 } }, { title: 'ok', priority: 'urgent' }, { title: 'ok', dueDate: '2026-02-30' }, { title: 'ok', dueDate: 'tomorrow' }, { title: 'ok', description: 'x'.repeat(501) }]) {
      assert.equal((await post(bad)).status, 400, JSON.stringify(bad).slice(0, 60))
    }
    const t = (await j(await post({ title: 'ok', completed: true }))).todo
    assert.equal(t.completed, false)
    assert.equal((await call(`/api/student/todos/${t.id}`, { method: 'PATCH', cookie: c, body: {} })).status, 400)
    assert.equal((await call(`/api/student/todos/${t.id}`, { method: 'PATCH', cookie: c, body: { completed: 'yes' } })).status, 400)
  })
})

test('todos: tasks belong to their owner on every operation', async () => {
  await withServer(async ({ call, reg, adminCookie }) => {
    const a = await reg('23A91A0501'), b = await reg('23A91A0502')
    const mine = (await j(await call('/api/student/todos', { method: 'POST', cookie: a, body: { title: 'A secret task' } }))).todo
    assert.equal((await j(await call('/api/student/todos', { cookie: b }))).todos.length, 0)
    assert.equal((await call(`/api/student/todos/${mine.id}`, { method: 'PATCH', cookie: b, body: { title: 'hacked', completed: true } })).status, 404)
    assert.equal((await call(`/api/student/todos/${mine.id}`, { method: 'DELETE', cookie: b })).status, 404)
    const still = (await j(await call('/api/student/todos', { cookie: a }))).todos[0]
    assert.equal(still.title, 'A secret task'); assert.equal(still.completed, false)
    assert.equal((await call('/api/student/todos')).status, 401)
    assert.equal((await call('/api/student/todos', { cookie: adminCookie })).status, 403)
  })
})

// ---------------- profile and semesters
test('profile: name can change; roll number, role and branch cannot be changed this way', async () => {
  await withServer(async ({ call, reg, users }) => {
    const c = await reg('23A91A0501')
    const res = await call('/api/student/profile', { method: 'PATCH', cookie: c, body: { name: '  Asha   K  Rao ', rollNumber: 'HACK1', role: 'admin', branch: 'ECE' } })
    assert.equal(res.status, 200)
    const { user } = await j(res)
    assert.equal(user.name, 'Asha K Rao'); assert.equal(user.rollNumber, '23A91A0501'); assert.equal(user.role, 'student'); assert.equal(user.branch, 'CSE')
    assert.equal((await users.findByRoll('SRGEC', '23A91A0501')).role, 'student')
    assert.equal((await call('/api/student/profile', { method: 'PATCH', cookie: c, body: { name: '  ' } })).status, 400)
    assert.equal((await call('/api/student/profile', { method: 'PATCH', cookie: c, body: { name: 'x'.repeat(81) } })).status, 400)
  })
})

test('semester change: forward only, valid pairs only', async () => {
  await withServer(async ({ call, reg }) => {
    const c = await reg('23A91A0501') // year 2, semester 3
    const go = (body) => call('/api/student/semester', { method: 'POST', cookie: c, body })
    assert.equal((await go({ year: 2, semester: 3 })).status, 400)   // same
    assert.equal((await go({ year: 2, semester: 5 })).status, 400)   // pair mismatch
    assert.equal((await go({ year: 1, semester: 2 })).status, 400)   // backwards
    assert.equal((await go({ year: 9, semester: 3 })).status, 400)
    assert.equal((await go({})).status, 400)
    const ok = await go({ year: 2, semester: 4 })
    assert.equal(ok.status, 200)
    const { user } = await j(ok)
    assert.equal(user.semester, 4); assert.equal(user.year, 2)
    assert.equal((await j(await call('/api/auth/me', { cookie: c }))).user.semester, 4) // same session keeps working
    assert.equal((await go({ year: 3, semester: 5 })).status, 200)
  })
})

test('semester change keeps old records, starts the new semester empty, and old semesters stay viewable', async () => {
  await withServer(async ({ call, reg, addSubject, subjects }) => {
    const m3 = await addSubject({ code: 'MA3', name: 'Maths III', semester: 3 })
    const gone = await addSubject({ code: 'OLD3', name: 'Dropped later', semester: 3 })
    const m4 = await addSubject({ code: 'MA4', name: 'Maths IV', semester: 4 })
    const c = await reg('23A91A0501')
    const put = (date, entries) => call(`/api/student/attendance/day/${date}`, { method: 'PUT', cookie: c, body: { entries } })
    await put('2026-10-23', [{ subjectId: m3.id, conducted: 4, attended: 3 }, { subjectId: gone.id, conducted: 2, attended: 2 }])
    await subjects.update(gone.id, { active: false }) // retired after the fact

    const before = await j(await call('/api/student/attendance/summary', { cookie: c }))
    assert.equal(before.overall.conducted, 4) // current semester ignores the retired subject

    assert.equal((await call('/api/student/semester', { method: 'POST', cookie: c, body: { year: 2, semester: 4 } })).status, 200)

    const now = await j(await call('/api/student/attendance/summary', { cookie: c }))
    assert.equal(now.semester, 4); assert.equal(now.overall.conducted, 0); assert.equal(now.overall.status, 'no_data')
    assert.deepEqual(now.subjects.map((s) => s.code), ['MA4'])

    const old = await j(await call('/api/student/attendance/summary?semester=3', { cookie: c }))
    assert.equal(old.semester, 3); assert.equal(old.isCurrent, false)
    assert.equal(old.overall.attended, 5); assert.equal(old.overall.conducted, 6) // retired subject counts again in history
    assert.deepEqual(old.subjects.map((s) => s.code), ['MA3', 'OLD3'])
    assert.equal((await j(await call('/api/student/attendance/history?semester=3', { cookie: c }))).entries.length, 2)
    assert.equal((await j(await call('/api/student/semesters', { cookie: c }))).available.join(), '4,3')

    for (const bad of ['2', '5', '9', 'x', '-1']) assert.equal((await call(`/api/student/attendance/summary?semester=${bad}`, { cookie: c })).status, 400, bad)
    // new semester entries go to semester 4 only
    await put('2026-10-24', [{ subjectId: m4.id, conducted: 1, attended: 1 }])
    assert.equal((await j(await call('/api/student/attendance/summary', { cookie: c }))).overall.conducted, 1)
    assert.equal((await j(await call('/api/student/attendance/summary?semester=3', { cookie: c }))).overall.conducted, 6)
  })
})

test('another student\'s semester data is never reachable through the semester parameter', async () => {
  await withServer(async ({ call, reg, addSubject }) => {
    const m = await addSubject({ code: 'MA3', semester: 3 })
    const a = await reg('23A91A0501'), b = await reg('23A91A0502', { semester: 4 })
    await call('/api/student/attendance/day/2026-10-24', { method: 'PUT', cookie: a, body: { entries: [{ subjectId: m.id, conducted: 3, attended: 3 }] } })
    assert.equal((await call('/api/student/attendance/summary?semester=3', { cookie: b })).status, 400) // B has no sem-3 records
  })
})

// ---------------- statistics
const S = [{ id: 'm', code: 'MA', name: 'Maths' }, { id: 'p', code: 'PH', name: 'Physics' }, { id: 'c', code: 'CH', name: 'Chem' }]
const E = (date, subjectId, attended, conducted) => ({ date, subjectId, attended, conducted })

test('statistics: cumulative trend, monthly totals, best and worst subject', () => {
  const st = statistics(S, [
    E('2026-09-30', 'm', 2, 2), E('2026-09-30', 'p', 0, 2),
    E('2026-10-01', 'm', 1, 2), E('2026-10-01', 'p', 2, 2),
  ])
  assert.deepEqual(st.trend.map((t) => [t.date, t.attended, t.conducted, t.percentage]), [['2026-09-30', 2, 4, 50], ['2026-10-01', 5, 8, 62.5]])
  assert.deepEqual(st.monthly.map((m) => [m.month, m.attended, m.conducted, m.percentage, m.days]), [['2026-09', 2, 4, 50, 1], ['2026-10', 3, 4, 75, 1]])
  assert.equal(st.highest.code, 'MA'); assert.equal(st.lowest.code, 'PH')  // MA 3/4, PH 2/4; CH has no classes so is excluded
  assert.equal(st.daysRecorded, 2)
  assert.equal(st.overall.percentage, 62.5)
})

test('statistics: ties are real ties, one subject cannot be both best and worst, empty is empty', () => {
  const tie = statistics(S, [E('2026-10-01', 'm', 1, 2), E('2026-10-01', 'p', 2, 4)])
  assert.equal(tie.highest.code, 'MA'); assert.equal(tie.lowest.code, 'PH') // equal 50%: stable order by code
  assert.equal(tie.highest.percentage, tie.lowest.percentage)
  const one = statistics(S, [E('2026-10-01', 'm', 1, 2)])
  assert.equal(one.highest.code, 'MA'); assert.equal(one.lowest, null)
  const none = statistics(S, [])
  assert.deepEqual([none.trend, none.monthly, none.highest, none.lowest, none.daysRecorded], [[], [], null, null, 0])
})

test('statistics: zero-class days count as recorded but never produce NaN; unknown subjects are ignored', () => {
  const st = statistics(S, [E('2026-10-01', 'm', 0, 0), E('2026-10-02', 'm', 1, 1), E('2026-10-02', 'ghost', 9, 9)])
  assert.equal(st.trend[0].percentage, null)
  assert.equal(st.trend[1].percentage, 100)
  assert.equal(st.daysRecorded, 2)
  assert.equal(st.overall.conducted, 1)
})

test('statistics endpoint: real numbers, private to the student', async () => {
  await withServer(async ({ call, reg, addSubject }) => {
    const m = await addSubject({ code: 'MA1' })
    const a = await reg('23A91A0501'), b = await reg('23A91A0502')
    await call('/api/student/attendance/day/2026-10-24', { method: 'PUT', cookie: a, body: { entries: [{ subjectId: m.id, conducted: 4, attended: 3 }] } })
    const st = await j(await call('/api/student/attendance/stats', { cookie: a }))
    assert.equal(st.overall.percentage, 75); assert.equal(st.trend.length, 1); assert.equal(st.monthly[0].month, '2026-10')
    const other = await j(await call('/api/student/attendance/stats', { cookie: b }))
    assert.deepEqual([other.trend, other.daysRecorded, other.overall.status], [[], 0, 'no_data'])
    assert.equal((await call('/api/student/attendance/stats')).status, 401)
  })
})
