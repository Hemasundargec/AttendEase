import mongoose from 'mongoose'

const entrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    semester: { type: Number, required: true, min: 1, max: 8 }, // academic period: keeps old semesters separate
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // India calendar date, YYYY-MM-DD
    conducted: { type: Number, required: true, min: 0, validate: Number.isInteger },
    attended: {
      type: Number, required: true, min: 0, validate: [Number.isInteger, 'must be a whole number'],
    },
  },
  { timestamps: true },
)
entrySchema.pre('validate', function () { if (this.attended > this.conducted) this.invalidate('attended', 'attended cannot exceed conducted') })
// The database itself refuses a second entry for the same student, subject, date and semester.
entrySchema.index({ userId: 1, subjectId: 1, date: 1, semester: 1 }, { unique: true })
entrySchema.index({ userId: 1, semester: 1, date: -1 })
const Entry = mongoose.models.AttendanceEntry || mongoose.model('AttendanceEntry', entrySchema)

const toPlain = (doc) => {
  const o = doc.toObject()
  return { id: String(o._id), userId: String(o.userId), subjectId: String(o.subjectId), semester: o.semester, date: o.date, conducted: o.conducted, attended: o.attended, createdAt: o.createdAt, updatedAt: o.updatedAt }
}

export function createMongoAttendanceRepo() {
  return {
    kind: 'mongodb',
    async init() { await Entry.init() },
    async upsertMany(userId, semester, date, rows) {
      const out = []
      for (const r of rows) {
        const doc = await Entry.findOneAndUpdate(
          { userId, subjectId: r.subjectId, date, semester },
          { $set: { conducted: r.conducted, attended: r.attended } },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
        )
        out.push(toPlain(doc))
      }
      return out
    },
    async forDate(userId, semester, date) { return (await Entry.find({ userId, semester, date })).map(toPlain) },
    async forSemester(userId, semester) { return (await Entry.find({ userId, semester }).sort({ date: -1 })).map(toPlain) },
    async semestersWithEntries(userId) { return (await Entry.distinct('semester', { userId })).sort((a, b) => a - b) },
    async countAll() { return Entry.countDocuments() },
  }
}
