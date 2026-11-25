// Runs ONLY when TEST_MONGODB_URI points at a throwaway database (e.g. a free Atlas cluster).
// Example: TEST_MONGODB_URI="mongodb+srv://..." npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { createMongoUserRepo } from '../src/repos/mongoUserRepo.js'
import { DuplicateUserError } from '../src/repos/errors.js'

const uri = process.env.TEST_MONGODB_URI

test('mongo user repo: unique roll number per college, uppercase normalisation, token version bump', { skip: !uri && 'set TEST_MONGODB_URI to run' }, async () => {
  await mongoose.connect(uri)
  const repo = createMongoUserRepo()
  await repo.init()
  const roll = `T${Date.now()}`
  try {
    const u = await repo.create({ name: 'T', rollNumber: roll.toLowerCase(), college: 'SRGEC', role: 'student', regulation: 'R23', branch: 'CSE', year: 1, semester: 1, passwordHash: 'x' })
    assert.equal(u.rollNumber, roll.toUpperCase())
    await assert.rejects(repo.create({ name: 'T2', rollNumber: roll, college: 'SRGEC', role: 'student', regulation: 'R23', branch: 'CSE', year: 1, semester: 1, passwordHash: 'y' }), DuplicateUserError)
    assert.equal((await repo.updatePassword(u.id, 'z')).tokenVersion, 1)
    assert.equal((await repo.findByRoll('SRGEC', roll.toUpperCase())).id, u.id)
  } finally {
    await mongoose.connection.collection('users').deleteMany({ rollNumber: roll.toUpperCase() })
    await mongoose.disconnect()
  }
})

// ---- Remaining repositories (same contract as the in-memory ones the rest of the suite uses) ----
import { createMongoSubjectRepo } from '../src/repos/mongoSubjectRepo.js'
import { createMongoAttendanceRepo } from '../src/repos/mongoAttendanceRepo.js'
import { createMongoTodoRepo } from '../src/repos/mongoTodoRepo.js'
import { createMongoTimetableRepo } from '../src/repos/mongoTimetableRepo.js'
import { DuplicateSubjectError } from '../src/repos/errors.js'

test('mongo subjects/attendance/todos/timetable: ownership, uniqueness, upsert and round-trips', { skip: !uri && 'set TEST_MONGODB_URI to run' }, async () => {
  await mongoose.connect(uri)
  const subjects = createMongoSubjectRepo(), attendance = createMongoAttendanceRepo(), todos = createMongoTodoRepo(), timetable = createMongoTimetableRepo()
  await Promise.all([subjects.init(), attendance.init(), todos.init(), timetable.init()])
  const tag = `ZZ${Date.now()}`, u1 = new mongoose.Types.ObjectId().toString(), u2 = new mongoose.Types.ObjectId().toString()
  const base = { college: tag, regulation: 'R23', branch: 'CSE', year: 2, semester: 3 }
  const student = (id) => ({ id, ...base })
  try {
    const shared = await subjects.create({ ...base, code: 'M1', name: 'Maths' })          // administrator subject (ownerId null)
    assert.equal(shared.ownerId, null)
    await assert.rejects(subjects.create({ ...base, code: 'M1', name: 'Again' }), DuplicateSubjectError)
    const a = await subjects.create({ ...base, code: 'M1', name: 'My Maths', ownerId: u1 })   // same code is fine for a student
    await subjects.create({ ...base, code: 'M1', name: 'Other Maths', ownerId: u2 })
    await assert.rejects(subjects.create({ ...base, code: 'M1', name: 'Dup', ownerId: u1 }), DuplicateSubjectError)
    assert.equal((await subjects.list(base)).length, 1)                                     // admin list excludes student subjects
    assert.deepEqual((await subjects.forStudent(student(u1))).map((s) => s.name).sort(), ['Maths', 'My Maths'])
    assert.equal(await subjects.countOwned(u1, 3), 1)
    assert.equal((await subjects.findById(a.id)).ownerId, u1)
    await subjects.update(a.id, { active: false })
    assert.equal(await subjects.countOwned(u1, 3), 0)
    assert.equal((await subjects.forStudentSemester(student(u1), 3)).length, 2)             // history keeps deactivated subjects

    const d = '2026-10-20'
    await attendance.upsertMany(u1, 3, d, [{ subjectId: shared.id, conducted: 2, attended: 1 }])
    await attendance.upsertMany(u1, 3, d, [{ subjectId: shared.id, conducted: 3, attended: 3 }]) // replaces, never duplicates
    const day = await attendance.forDate(u1, 3, d)
    assert.equal(day.length, 1); assert.equal(day[0].conducted, 3)
    await assert.rejects(attendance.upsertMany(u1, 3, '2026-10-21', [{ subjectId: shared.id, conducted: 1, attended: 2 }])) // attended > conducted refused by the database layer
    assert.deepEqual(await attendance.semestersWithEntries(u1), [3])
    assert.equal((await attendance.forSemester(u1, 3)).length, 1)

    assert.equal(await timetable.get(u1, 3), null)
    await timetable.set(u1, 3, { 1: [shared.id, shared.id], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] })
    await timetable.set(u1, 3, { 1: [shared.id], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] })   // overwrite
    assert.deepEqual((await timetable.get(u1, 3))['1'], [shared.id])

    const t = await todos.create(u1, { title: 'Submit record', priority: 'high', dueDate: '2026-11-01' })
    assert.equal((await todos.list(u1)).length, 1); assert.equal((await todos.list(u2)).length, 0)
    assert.equal((await todos.update(u1, t.id, { completed: true })).completed, true)
    assert.equal(await todos.remove(u2, t.id), false)                                         // another student cannot delete it
    assert.equal(await todos.remove(u1, t.id), true)
  } finally {
    const c = mongoose.connection
    await c.collection('subjects').deleteMany({ college: tag })
    for (const [name, field] of [['attendanceentries', 'userId'], ['timetables', 'userId'], ['todos', 'userId']]) {
      await c.collection(name).deleteMany({ [field]: { $in: [new mongoose.Types.ObjectId(u1), new mongoose.Types.ObjectId(u2), u1, u2] } })
    }
    await mongoose.disconnect()
  }
})
