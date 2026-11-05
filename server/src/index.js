import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createApp } from './app.js'
import { createMongoStorage, createFileStorage } from './storage.js'
import { createMongoUserRepo } from './repos/mongoUserRepo.js'
import { createMemoryUserRepo } from './repos/memoryUserRepo.js'
import { createMongoSubjectRepo } from './repos/mongoSubjectRepo.js'
import { createMemorySubjectRepo } from './repos/memorySubjectRepo.js'
import { createMongoAttendanceRepo } from './repos/mongoAttendanceRepo.js'
import { createMemoryAttendanceRepo } from './repos/memoryAttendanceRepo.js'
import { createMongoTodoRepo } from './repos/mongoTodoRepo.js'
import { createMemoryTodoRepo } from './repos/memoryTodoRepo.js'
import { createMongoTimetableRepo } from './repos/mongoTimetableRepo.js'
import { createMemoryTimetableRepo } from './repos/memoryTimetableRepo.js'
import { createMongoReminderLogRepo } from './repos/mongoReminderLogRepo.js'
import { createMemoryReminderLogRepo } from './repos/memoryReminderLogRepo.js'
import { createMailer } from './mailer.js'
import { startReminderScheduler } from './reminderService.js'

const here = dirname(fileURLToPath(import.meta.url))
const isProduction = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT) || 4000

let formSecret = process.env.FORM_SECRET
if (!formSecret) {
  if (isProduction) {
    console.error('FORM_SECRET is required in production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
    process.exit(1)
  }
  formSecret = randomBytes(32).toString('hex')
  console.warn('FORM_SECRET not set: using a temporary one (form tokens reset on restart). Fine for development only.')
}

let jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
  if (isProduction) { console.error('JWT_SECRET is required in production (use a different random value from FORM_SECRET).'); process.exit(1) }
  jwtSecret = randomBytes(32).toString('hex')
  console.warn('JWT_SECRET not set: using a temporary one (everyone is logged out on restart). Fine for development only.')
}
if (isProduction && jwtSecret.length < 32) { console.error('JWT_SECRET must be at least 32 characters.'); process.exit(1) }

let storage
let users
let subjects
let attendance
let todos
let timetable
let reminderLogs
if (process.env.MONGODB_URI) {
  try {
    storage = await createMongoStorage(process.env.MONGODB_URI)
    users = createMongoUserRepo()
    await users.init()
    subjects = createMongoSubjectRepo(); await subjects.init()
    attendance = createMongoAttendanceRepo(); await attendance.init()
    todos = createMongoTodoRepo(); await todos.init()
    timetable = createMongoTimetableRepo(); await timetable.init()
    reminderLogs = createMongoReminderLogRepo(); await reminderLogs.init()
    console.log('Connected to MongoDB.')
  } catch (err) {
    console.error('Could not connect to MongoDB:', err.message)
    process.exit(1) // never silently fall back to fake or temporary storage
  }
} else if (isProduction) {
  console.error('MONGODB_URI is required in production.')
  process.exit(1)
} else {
  const file = join(here, '..', 'data', 'waitlist.jsonl')
  storage = createFileStorage(file)
  users = createMemoryUserRepo()
  subjects = createMemorySubjectRepo()
  attendance = createMemoryAttendanceRepo()
  todos = createMemoryTodoRepo()
  timetable = createMemoryTimetableRepo()
  reminderLogs = createMemoryReminderLogRepo()
  console.warn('Development mode: user accounts are kept in memory and are lost when the server restarts.')
  console.warn(`MONGODB_URI not set: development mode, signups are written to ${file}`)
}

const mailer = createMailer({ apiKey: process.env.RESEND_API_KEY || '', from: process.env.MAIL_FROM || '' })
console.log(mailer.mode === 'resend' ? 'Email: Resend configured.' : 'Email: no provider configured. Verification codes and reminders are printed to this log, not sent.')

const app = createApp({
  mailer,
  storage,
  users,
  subjects,
  attendance,
  todos,
  timetable,
  jwtSecret,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
  formSecret,
  isProduction,
  canonicalHost: process.env.CANONICAL_HOST || '',
  turnstileSecret: process.env.TURNSTILE_SECRET || '',
  distDir: join(here, '..', '..', 'client', 'dist'),
})

app.listen(port, () => console.log(`AttendEase server listening on port ${port} (${isProduction ? 'production' : 'development'})`))

// Reminders run on the server, so they work with every browser closed. Safe with several server copies:
// the database lets only one of them claim each student's slot.
if (process.env.REMINDERS_SCHEDULER !== 'off') {
  startReminderScheduler({ users, subjects, attendance, logs: reminderLogs, mailer, jwtSecret, siteUrl: process.env.SITE_URL || '' })
  console.log('Reminder scheduler running (checks every minute, India time).')
}
