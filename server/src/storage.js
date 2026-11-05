import { appendFile, readFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import mongoose from 'mongoose'

// ---- MongoDB (use this in production) ------------------------------------------------
const signupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, unique: true },
    consentAt: { type: Date, required: true },
  },
  { timestamps: true },
)
const Signup = mongoose.models.Signup || mongoose.model('Signup', signupSchema)

export async function createMongoStorage(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
  await Signup.init() // makes sure the unique email index exists
  return {
    kind: 'mongodb',
    // Returns true if newly stored, false if that email was already on the list.
    async addSignup({ name, email }) {
      try {
        await Signup.create({ name, email, consentAt: new Date() })
        return true
      } catch (err) {
        if (err?.code === 11000) return false
        throw err
      }
    },
    async close() { await mongoose.disconnect() },
  }
}

// ---- Local file (development only, never used silently) -------------------------------
export function createFileStorage(path) {
  return {
    kind: 'file',
    async addSignup({ name, email }) {
      await mkdir(dirname(path), { recursive: true })
      let existing = ''
      try { existing = await readFile(path, 'utf8') } catch { /* first run */ }
      if (existing.split('\n').some((line) => line && JSON.parse(line).email === email)) return false
      await appendFile(path, JSON.stringify({ name, email, consentAt: new Date().toISOString() }) + '\n')
      return true
    },
    async close() {},
  }
}
