import mongoose from 'mongoose'
import { DuplicateSubjectError } from './errors.js'

const subjectSchema = new mongoose.Schema(
  {
    college: { type: String, required: true },
    regulation: { type: String, required: true },
    branch: { type: String, required: true },
    year: { type: Number, required: true, min: 1, max: 4 },
    semester: { type: Number, required: true, min: 1, max: 8 },
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 20 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    active: { type: Boolean, default: true },
    ownerId: { type: String, default: null }, // null = managed by an administrator; otherwise the student who added it
  },
  { timestamps: true },
)
subjectSchema.index({ college: 1, regulation: 1, branch: 1, semester: 1, code: 1, ownerId: 1 }, { unique: true })
subjectSchema.index({ ownerId: 1, semester: 1, active: 1 })
subjectSchema.index({ college: 1, regulation: 1, branch: 1, year: 1, semester: 1, active: 1 })
const Subject = mongoose.models.Subject || mongoose.model('Subject', subjectSchema)

const toPlain = (doc) => { if (!doc) return null; const o = doc.toObject(); return { ...o, id: String(o._id), _id: undefined, __v: undefined } }
const wrapDup = async (fn) => { try { return await fn() } catch (e) { if (e?.code === 11000) throw new DuplicateSubjectError(); throw e } }

export function createMongoSubjectRepo() {
  return {
    kind: 'mongodb',
    async init() { await Subject.init() },
    create: (data) => wrapDup(async () => toPlain(await Subject.create(data))),
    async findById(id) { return mongoose.isValidObjectId(id) ? toPlain(await Subject.findById(id)) : null },
    update: (id, changes) => wrapDup(async () => (mongoose.isValidObjectId(id) ? toPlain(await Subject.findByIdAndUpdate(id, changes, { new: true, runValidators: true })) : null)),
    async list(filter = {}) {
      const q = Object.fromEntries(Object.entries(filter).filter(([, v]) => v !== undefined))
      if (filter.ownerId === undefined) q.ownerId = null // administrator-managed subjects only
      return (await Subject.find(q).sort({ code: 1 })).map(toPlain)
    },
    async forStudent(u) {
      const shared = await this.list({ college: u.college, regulation: u.regulation, branch: u.branch, year: u.year, semester: u.semester, active: true })
      const own = await this.list({ ownerId: u.id, semester: u.semester, active: true })
      return [...shared, ...own].sort((a, b) => a.code.localeCompare(b.code))
    },
    async forStudentSemester(u, semester) {
      const shared = await this.list({ college: u.college, regulation: u.regulation, branch: u.branch, semester })
      const own = await this.list({ ownerId: u.id, semester })
      return [...shared, ...own].sort((a, b) => a.code.localeCompare(b.code))
    },
    async countOwned(ownerId, semester) { return Subject.countDocuments({ ownerId, semester, active: true }) },
  }
}
