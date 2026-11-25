import { test } from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { createApp } from '../src/app.js'
import { createMemoryUserRepo } from '../src/repos/memoryUserRepo.js'
import { createMemorySubjectRepo } from '../src/repos/memorySubjectRepo.js'
import { createMemoryAttendanceRepo } from '../src/repos/memoryAttendanceRepo.js'
import { createMemoryTodoRepo } from '../src/repos/memoryTodoRepo.js'
import { createMemoryTimetableRepo } from '../src/repos/memoryTimetableRepo.js'
import { buildSheet, dayMark, daysInMonth } from '../src/lib/sheet.js'

process.env.BCRYPT_COST = '4'
const NOW = new Date('2026-10-26T05:00:00Z')

test('dayMark: P, Pt, A, H and blank', () => {
  assert.equal(dayMark({ conducted: 5, attended: 5 }), 'P')
  assert.equal(dayMark({ conducted: 5, attended: 3 }), 'Pt')
  assert.equal(dayMark({ conducted: 5, attended: 0 }), 'A')
  assert.equal(dayMark({ conducted: 0, attended: 0 }), 'H')
  assert.equal(dayMark(undefined, true), 'H')   // Sunday with nothing entered
  assert.equal(dayMark(undefined, false), '')   // nothing entered
  assert.equal(dayMark({ conducted: 2, attended: 2 }, true), 'P') // classes on a Sunday still count
})

test('buildSheet: layout, impossible dates, leap year, totals, other years ignored', () => {
  assert.equal(daysInMonth(2028, 2), 29); assert.equal(daysInMonth(2026, 2), 28)
  const s = buildSheet([
    { date: '2026-10-05', conducted: 3, attended: 3 }, { date: '2026-10-05', conducted: 2, attended: 2 }, // two subjects, same day -> P
    { date: '2026-10-06', conducted: 4, attended: 1 }, { date: '2026-10-07', conducted: 3, attended: 0 },
    { date: '2026-10-08', conducted: 0, attended: 0 }, { date: '2025-10-09', conducted: 9, attended: 9 },
  ], 2026)
  assert.equal(s.rows.length, 31); assert.ok(s.rows.every((r) => r.length === 12))
  assert.equal(s.rows[4][9], 'P'); assert.equal(s.rows[5][9], 'Pt'); assert.equal(s.rows[6][9], 'A'); assert.equal(s.rows[7][9], 'H')
  assert.equal(s.rows[8][9], '')                    // 9 Oct 2026 not entered (2025 entry ignored)
  assert.equal(s.rows[29][1], null); assert.equal(s.rows[30][3], null) // 30 Feb, 31 Apr do not exist
  assert.equal(s.totals.present, 1); assert.equal(s.totals.partial, 1); assert.equal(s.totals.absent, 1)
  assert.equal(s.totals.classesConducted, 12); assert.equal(s.totals.classesAttended, 6)
  const sundays = 52 + 0 // 2026 has 52 Sundays; Oct 4,11,18,25 are blank-Sundays -> H
  assert.equal(s.totals.holiday - 1, sundays) // + the one explicit "no classes" day
})

async function withServer(fn) {
  const app = createApp({ storage: { kind: 'memory' }, users: createMemoryUserRepo(), subjects: createMemorySubjectRepo(), attendance: createMemoryAttendanceRepo(), todos: createMemoryTodoRepo(), timetable: createMemoryTimetableRepo(), now: () => NOW, jwtSecret: 'x'.repeat(40), formSecret: 'f' })
  const server = app.listen(0); const base = `http://127.0.0.1:${server.address().port}`
  const call = (path, { method = 'GET', body, cookie } = {}) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const reg = (roll) => call('/api/auth/register', { method: 'POST', body: { name: 'Sheet ' + roll, rollNumber: roll, college: 'SRGEC', regulation: 'R23', branch: 'CSE', year: 2, semester: 3, password: 'Sunrise2026', confirmPassword: 'Sunrise2026' } }).then((r) => r.headers.getSetCookie().find((c) => c.startsWith('attendease_session=')).split(';')[0])
  try { await fn({ call, reg }) } finally { server.close() }
}

test('sheet endpoint + Excel download reflect saved attendance; login required; bad year refused', async () => {
  await withServer(async ({ call, reg }) => {
    assert.equal((await call('/api/student/attendance/sheet')).status, 401)
    assert.equal((await call('/api/student/attendance/sheet.xlsx')).status, 401)
    const c = await reg('23A91A0699')
    const m = (await (await call('/api/student/my-subjects', { method: 'POST', cookie: c, body: { name: 'Maths' } })).json()).subject
    const p = (await (await call('/api/student/my-subjects', { method: 'POST', cookie: c, body: { name: 'Physics' } })).json()).subject
    const put = (date, entries) => call(`/api/student/attendance/day/${date}`, { method: 'PUT', cookie: c, body: { entries } })
    assert.equal((await put('2026-10-20', [{ subjectId: m.id, conducted: 2, attended: 2 }, { subjectId: p.id, conducted: 1, attended: 1 }])).status, 200)
    assert.equal((await put('2026-10-21', [{ subjectId: m.id, conducted: 2, attended: 0 }, { subjectId: p.id, conducted: 1, attended: 0 }])).status, 200)
    assert.equal((await put('2026-10-22', [{ subjectId: m.id, conducted: 2, attended: 1 }, { subjectId: p.id, conducted: 0, attended: 0 }])).status, 200)

    const j = await (await call('/api/student/attendance/sheet', { cookie: c })).json()
    assert.equal(j.year, 2026); assert.deepEqual([j.rows[19][9], j.rows[20][9], j.rows[21][9]], ['P', 'A', 'Pt'])
    assert.equal(j.totals.classesConducted, 8); assert.equal(j.totals.classesAttended, 4)
    assert.ok(j.years.includes(2026))
    assert.equal((await call('/api/student/attendance/sheet?year=1999', { cookie: c })).status, 400)
    assert.equal((await call('/api/student/attendance/sheet?year=abc', { cookie: c })).status, 400)
    assert.equal((await (await call('/api/student/attendance/sheet?year=2025', { cookie: c })).json()).totals.present, 0)

    const x = await call('/api/student/attendance/sheet.xlsx?year=2026', { cookie: c })
    assert.equal(x.status, 200)
    assert.match(x.headers.get('content-type'), /spreadsheetml/)
    assert.match(x.headers.get('content-disposition'), /attachment; filename="AttendEase-attendance-2026-23A91A0699\.xlsx"/)
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await x.arrayBuffer()))
    const ws = wb.getWorksheet('Attendance 2026')
    assert.equal(ws.getCell('A9').value, 'Date | Month'); assert.equal(ws.getCell('K9').value, 'October')
    assert.equal(ws.getCell('K29').value, 'P'); assert.equal(ws.getCell('K30').value, 'A'); assert.equal(ws.getCell('K31').value, 'Pt') // row 10 = day 1
    assert.equal(ws.getCell('C39').value, '-')   // 30 Feb is not a date
    assert.equal(ws.getCell('B6').value.formula.startsWith('COUNTIF'), true)
    const sw = wb.getWorksheet('Subject-wise')
    assert.equal(sw.getCell('B2').value, 'Maths'); assert.equal(sw.getCell('C2').value, 6); assert.equal(sw.getCell('D2').value, 3)
    assert.equal(sw.getCell('B3').value, 'Physics'); assert.equal(sw.getCell('C3').value, 2); assert.equal(sw.getCell('D3').value, 1)
  })
})
