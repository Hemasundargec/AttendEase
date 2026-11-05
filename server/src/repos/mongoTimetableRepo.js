import mongoose from 'mongoose'

const timetableSchema = new mongoose.Schema(
  { userId: { type: String, required: true }, semester: { type: Number, required: true, min: 1, max: 8 }, days: { type: mongoose.Schema.Types.Mixed, default: {} } },
  { timestamps: true, minimize: false },
)
timetableSchema.index({ userId: 1, semester: 1 }, { unique: true })
const Timetable = mongoose.models.Timetable || mongoose.model('Timetable', timetableSchema)

export function createMongoTimetableRepo() {
  return {
    kind: 'mongodb',
    async init() { await Timetable.init() },
    async get(userId, semester) { const r = await Timetable.findOne({ userId, semester }); return r ? r.toObject().days : null },
    async set(userId, semester, days) {
      await Timetable.findOneAndUpdate({ userId, semester }, { days }, { upsert: true, new: true, setDefaultsOnInsert: true })
      return days
    },
  }
}
