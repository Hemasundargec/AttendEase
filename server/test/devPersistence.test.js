import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { attachFilePersistence } from '../src/lib/devPersistence.js'
import { createMemoryUserRepo } from '../src/repos/memoryUserRepo.js'
import { createMemorySubjectRepo } from '../src/repos/memorySubjectRepo.js'
import { createMemoryAttendanceRepo } from '../src/repos/memoryAttendanceRepo.js'
import { createMemoryTodoRepo } from '../src/repos/memoryTodoRepo.js'
import { createMemoryTimetableRepo } from '../src/repos/memoryTimetableRepo.js'
import { createMemoryReminderLogRepo } from '../src/repos/memoryReminderLogRepo.js'

const make = () => ({ users: createMemoryUserRepo(), subjects: createMemorySubjectRepo(), attendance: createMemoryAttendanceRepo(), todos: createMemoryTodoRepo(), timetable: createMemoryTimetableRepo(), reminderLogs: createMemoryReminderLogRepo() })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

test('accounts and data survive a "restart"; dates stay real Dates; corrupt file does not crash', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-'))
  const file = path.join(dir, 'sub', 'dev-db.json')
  const a = make(); assert.equal(attachFilePersistence(file, a), 0)
  const u = await a.users.create({ name: 'N', rollNumber: 'R1', college: 'SRGEC', role: 'student', regulation: 'R23', branch: 'CSE', year: 2, semester: 3, passwordHash: 'h' })
  const s = await a.subjects.create({ college: 'SRGEC', regulation: 'R23', branch: 'CSE', year: 2, semester: 3, code: 'M', name: 'Maths', ownerId: u.id })
  await a.attendance.upsertMany(u.id, 3, '2026-10-20', [{ subjectId: s.id, conducted: 2, attended: 1 }])
  await a.todos.create(u.id, { title: 'x', priority: 'low', dueDate: null })
  await a.timetable.set(u.id, 3, { 1: [s.id] })
  await a.reminderLogs.tryClaim(u.id, '2026-10-20', '17:00')
  await wait(400)

  const b = make(); assert.ok(attachFilePersistence(file, b) >= 6)
  const u2 = await b.users.findByRoll('SRGEC', 'R1')
  assert.equal(u2.id, u.id); assert.equal(u2.passwordHash, 'h'); assert.ok(u2.createdAt instanceof Date)
  assert.equal((await b.attendance.forDate(u.id, 3, '2026-10-20'))[0].attended, 1)
  assert.equal((await b.subjects.forStudent({ id: u.id, college: 'SRGEC', regulation: 'R23', branch: 'CSE', year: 2, semester: 3 })).length, 1)
  assert.equal((await b.todos.list(u.id)).length, 1)
  assert.deepEqual((await b.timetable.get(u.id, 3))['1'], [s.id])
  assert.equal(await b.reminderLogs.tryClaim(u.id, '2026-10-20', '17:00'), false) // no duplicate reminder after a restart
  assert.equal(await b.users.create({ name: 'N2', rollNumber: 'R2', college: 'SRGEC', role: 'student', regulation: 'R23', branch: 'CSE', year: 2, semester: 3, passwordHash: 'h' }).then(() => 'ok'), 'ok')

  fs.writeFileSync(file, '{not json')
  const c = make(); assert.equal(attachFilePersistence(file, c), 0) // starts empty instead of crashing
  const kept = fs.readdirSync(path.dirname(file)).filter((n) => n.includes('.corrupt-'))
  assert.equal(kept.length, 1)                                       // the unreadable file is kept as a backup, never silently destroyed
  assert.equal(fs.readFileSync(path.join(path.dirname(file), kept[0]), 'utf8'), '{not json')
})
