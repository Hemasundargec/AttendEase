import mongoose from 'mongoose'
import { DuplicateUserError } from './errors.js'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    rollNumber: { type: String, required: true, uppercase: true, trim: true, maxlength: 30 },
    college: { type: String, required: true, trim: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student', required: true },
    // Academic details are required for students; admins do not have them.
    regulation: { type: String, required: function () { return this.role === 'student' } },
    branch: { type: String, required: function () { return this.role === 'student' } },
    year: { type: Number, min: 1, max: 4, required: function () { return this.role === 'student' } },
    semester: { type: Number, min: 1, max: 8, required: function () { return this.role === 'student' } },
    passwordHash: { type: String, required: true, select: true },
    tokenVersion: { type: Number, default: 0 },
    email: { type: String, default: null, lowercase: true, trim: true, maxlength: 254 },
    emailVerified: { type: Boolean, default: false },
    remindersEnabled: { type: Boolean, default: false },
    pendingEmail: { type: String, default: null },
    codeHash: { type: String, default: null },
    codeExpiresAt: { type: Date, default: null },
    codeAttempts: { type: Number, default: 0 },
  },
  { timestamps: true },
)
// One roll number per college. The database enforces this, not just the application.
userSchema.index({ college: 1, rollNumber: 1 }, { unique: true })
userSchema.index({ role: 1, branch: 1, semester: 1 })

const User = mongoose.models.User || mongoose.model('User', userSchema)

const toPlain = (doc) => {
  if (!doc) return null
  const o = doc.toObject()
  return { ...o, id: String(o._id), _id: undefined, __v: undefined }
}

export function createMongoUserRepo() {
  return {
    kind: 'mongodb',
    async init() { await User.init() },
    async findByRoll(college, rollNumber) { return toPlain(await User.findOne({ college, rollNumber })) },
    async findById(id) {
      if (!mongoose.isValidObjectId(id)) return null
      return toPlain(await User.findById(id))
    },
    async create(data) {
      try { return toPlain(await User.create(data)) } catch (err) {
        if (err?.code === 11000) throw new DuplicateUserError()
        throw err
      }
    },
    async updatePassword(id, passwordHash) {
      return toPlain(await User.findByIdAndUpdate(id, { passwordHash, $inc: { tokenVersion: 1 } }, { new: true }))
    },
    async updateProfile(id, { name }) { return toPlain(await User.findByIdAndUpdate(id, { name }, { new: true, runValidators: true })) },
    async updateAcademic(id, { year, semester }) { return toPlain(await User.findByIdAndUpdate(id, { year, semester }, { new: true, runValidators: true })) },
    async setEmailChallenge(id, { email, codeHash, expiresAt }) { return toPlain(await User.findByIdAndUpdate(id, { pendingEmail: email, codeHash, codeExpiresAt: expiresAt, codeAttempts: 0 }, { new: true })) },
    async bumpCodeAttempts(id) { return toPlain(await User.findByIdAndUpdate(id, { $inc: { codeAttempts: 1 } }, { new: true })) },
    async confirmEmail(id) {
      const u = await User.findById(id); if (!u || !u.pendingEmail) return null
      return toPlain(await User.findByIdAndUpdate(id, { email: u.pendingEmail, emailVerified: true, remindersEnabled: true, pendingEmail: null, codeHash: null, codeExpiresAt: null, codeAttempts: 0 }, { new: true }))
    },
    async removeEmail(id) { return toPlain(await User.findByIdAndUpdate(id, { email: null, emailVerified: false, remindersEnabled: false, pendingEmail: null, codeHash: null, codeExpiresAt: null }, { new: true })) },
    async setRemindersEnabled(id, enabled) { return toPlain(await User.findByIdAndUpdate(id, { remindersEnabled: enabled }, { new: true })) },
    async listReminderRecipients() { return (await User.find({ role: 'student', remindersEnabled: true, emailVerified: true, email: { $ne: null } })).map(toPlain) },
    async countStudents() { return User.countDocuments({ role: 'student' }) },
    async countStudentsByBranchAndSemester() {
      const rows = await User.aggregate([
        { $match: { role: 'student' } },
        { $group: { _id: { branch: '$branch', semester: '$semester' }, count: { $sum: 1 } } },
        { $sort: { '_id.branch': 1, '_id.semester': 1 } },
      ])
      return rows.map((r) => ({ branch: r._id.branch, semester: r._id.semester, count: r.count }))
    },
  }
}
