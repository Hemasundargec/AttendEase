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
