import mongoose from 'mongoose'

const schema = new mongoose.Schema(
  { userId: { type: mongoose.Schema.Types.ObjectId, required: true }, date: { type: String, required: true }, slot: { type: String, required: true },
    status: { type: String, default: 'claimed' }, detail: { type: String, default: '' } },
  { timestamps: true },
)
schema.index({ userId: 1, date: 1, slot: 1 }, { unique: true }) // the database guarantees one reminder per slot
schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }) // logs expire after 90 days
const Log = mongoose.models.ReminderLog || mongoose.model('ReminderLog', schema)

export function createMongoReminderLogRepo() {
  return {
    kind: 'mongodb',
    async init() { await Log.init() },
    async tryClaim(userId, date, slot) {
      try { await Log.create({ userId, date, slot }); return true } catch (e) { if (e?.code === 11000) return false; throw e }
    },
    async setResult(userId, date, slot, status, detail = '') { await Log.updateOne({ userId, date, slot }, { status, detail: String(detail).slice(0, 200) }) },
    async list() { return (await Log.find().lean()).map((r) => ({ ...r, userId: String(r.userId) })) },
  }
}
