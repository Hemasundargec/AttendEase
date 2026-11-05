import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { publicUser } from './auth.js'
import { academics, semestersForYear } from '../config/academics.js'
import { summarize, statistics, safeLeave, recovery, todayInIndia, weekdayName, STATUS } from '../lib/attendance.js'
import { policy } from '../config/policy.js'
import { reminderConfig } from '../config/reminders.js'
import { validateDailyEntries, validateDateParam, parseTarget } from '../validators/attendance.js'
import { validateTodo } from '../validators/todo.js'
import { validateMySubject, autoCode, validateTimetable } from '../validators/mySubject.js'
import { DuplicateSubjectError } from '../repos/errors.js'

// Every route here is student-only. The student is ALWAYS the logged-in user (req.user);
// no route accepts a user id from the browser, so one student cannot reach another's records.
export function studentRoutes({ users, subjects, attendance, todos, timetable, mailer, jwtSecret, now = () => new Date(), emailLimit = { windowMs: 60 * 60 * 1000, max: 5 } }) {
  const router = Router()
  router.use(requireAuth({ users, jwtSecret }), requireRole('student'))
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })

  const mySubjects = (req) => subjects.forStudent(req.user)

  // Which semester a read endpoint is about. Default: the current one. A student may also look at
  // their OWN earlier semesters (only ones with saved entries), never anything later or anyone else's.
  async function scopeOf(req, res) {
    const current = req.user.semester
    if (req.query.semester === undefined || Number(req.query.semester) === current) {
      return { semester: current, list: await mySubjects(req), isCurrent: true }
    }
    const wanted = Number(req.query.semester)
    const available = await attendance.semestersWithEntries(req.user.id)
    if (!Number.isInteger(wanted) || wanted > current || !available.includes(wanted)) {
      res.status(400).json({ message: 'No attendance was recorded for that semester.' }); return null
    }
    // Old semesters keep ALL of their subjects, even ones deactivated later, so history stays complete.
    const list = await subjects.forStudentSemester(req.user, wanted)
    return { semester: wanted, list, isCurrent: false }
  }
  const today = () => todayInIndia(now())

  router.get('/subjects', async (req, res) => {
    const list = await mySubjects(req)
    res.json({ subjects: list.map(({ id, code, name, ownerId }) => ({ id, code, name, mine: Boolean(ownerId) })) })
  })

  // Entries for one date, merged with the subject list so "not entered yet" is distinct from "0 classes".
  router.get('/attendance/day/:date', async (req, res) => {
    const problem = validateDateParam(req.params.date, { today: today(), maxBackdateDays: policy.maxBackdateDays })
    // Reading a past date is always allowed even beyond the edit window; only malformed/future is refused.
    if (problem && !/days back/.test(problem)) return res.status(400).json({ message: problem })
    const list = await mySubjects(req)
    const saved = await attendance.forDate(req.user.id, req.user.semester, req.params.date)
    const byId = new Map(saved.map((e) => [e.subjectId, e]))
    const dow = new Date(`${req.params.date}T00:00:00Z`).getUTCDay() || 7 // Monday = 1 ... Sunday = 7
    const table = timetable ? await timetable.get(req.user.id, req.user.semester) : null
    const known = new Set(list.map((x) => x.id))
    const periods = ((table && table[String(dow)]) || []).filter((id) => known.has(id))
    res.json({
      date: req.params.date, weekday: weekdayName(req.params.date), editable: !problem, periods,
      subjects: list.map((s) => {
        const e = byId.get(s.id)
        return { id: s.id, code: s.code, name: s.name, entered: Boolean(e), conducted: e ? e.conducted : null, attended: e ? e.attended : null }
      }),
    })
  })

  router.put('/attendance/day/:date', async (req, res) => {
    const problem = validateDateParam(req.params.date, { today: today(), maxBackdateDays: policy.maxBackdateDays })
    if (problem) return res.status(400).json({ message: problem })
    const list = await mySubjects(req)
    if (list.length === 0) return res.status(400).json({ message: 'No subjects are set up for your semester yet.' })
    const result = validateDailyEntries(req.body, list.map((s) => s.id))
    if (!result.ok) return res.status(400).json({ message: result.message, rowErrors: result.rowErrors })
    const saved = await attendance.upsertMany(req.user.id, req.user.semester, req.params.date, result.rows)
    res.json({ message: 'Attendance saved.', saved: saved.length })
  })

  // ---- The student's own subjects and weekly timetable (current semester only). ----
  const MAX_OWN_SUBJECTS = 15
  router.post('/my-subjects', async (req, res) => {
    const { ok, fieldErrors, value } = validateMySubject(req.body)
    if (!ok) return res.status(400).json({ message: 'Please fix the highlighted fields.', fieldErrors })
    const u = req.user
    if ((await subjects.countOwned(u.id, u.semester)) >= MAX_OWN_SUBJECTS) return res.status(400).json({ message: `You can add up to ${MAX_OWN_SUBJECTS} subjects of your own per semester.` })
    const base = { college: u.college, regulation: u.regulation, branch: u.branch, year: u.year, semester: u.semester, name: value.name, ownerId: u.id }
    try {
      if (value.code) return res.status(201).json({ subject: pick(await subjects.create({ ...base, code: value.code })) })
      const stem = autoCode(value.name)
      for (let n = 1; n <= 30; n++) {
        try { return res.status(201).json({ subject: pick(await subjects.create({ ...base, code: n === 1 ? stem : `${stem}${n}` })) }) } catch (e) { if (!(e instanceof DuplicateSubjectError)) throw e }
      }
      return res.status(409).json({ message: 'Could not make a code for that subject. Please type one.', fieldErrors: { code: 'Please type a code.' } })
    } catch (e) {
      if (e instanceof DuplicateSubjectError) return res.status(409).json({ message: 'You already used that code in this semester (maybe for a removed subject). Choose another.', fieldErrors: { code: 'Code already used.' } })
      throw e
    }
  })
  const pick = ({ id, code, name }) => ({ id, code, name, mine: true })

  // Removing hides the subject from now on; attendance already saved for it stays in your history.
  router.delete('/my-subjects/:id', async (req, res) => {
    const subject = await subjects.findById(req.params.id)
    if (!subject || subject.ownerId !== req.user.id) return res.status(404).json({ message: 'Subject not found.' })
    await subjects.update(subject.id, { active: false })
    if (timetable) {
      const days = await timetable.get(req.user.id, subject.semester)
      if (days) {
        for (const k of Object.keys(days)) days[k] = days[k].filter((id) => id !== subject.id)
        await timetable.set(req.user.id, subject.semester, days)
      }
    }
    res.json({ message: 'Subject removed.' })
  })

  if (timetable) {
    router.get('/timetable', async (req, res) => {
      const days = (await timetable.get(req.user.id, req.user.semester)) || {}
      const list = await mySubjects(req)
      const known = new Set(list.map((x) => x.id))
      const out = {}
      for (let d = 1; d <= 7; d++) out[String(d)] = (days[String(d)] || []).filter((id) => known.has(id))
      res.json({ semester: req.user.semester, days: out, subjects: list.map(({ id, code, name, ownerId }) => ({ id, code, name, mine: Boolean(ownerId) })) })
    })
    router.put('/timetable', async (req, res) => {
      const list = await mySubjects(req)
      const result = validateTimetable(req.body, list.map((x) => x.id))
      if (!result.ok) return res.status(400).json({ message: result.message })
      await timetable.set(req.user.id, req.user.semester, result.days)
      res.json({ message: 'Timetable saved.', days: result.days })
    })
  }

  router.get('/attendance/summary', async (req, res) => {
    const scope = await scopeOf(req, res); if (!scope) return
    const { list } = scope
    const entries = await attendance.forSemester(req.user.id, scope.semester)
    const todays = entries.filter((e) => e.date === today() && list.some((s) => s.id === e.subjectId))
    const savedToday = new Set(todays.map((e) => e.subjectId)).size
    res.json({
      semester: scope.semester, isCurrent: scope.isCurrent,
      policy: { safePercent: policy.safePercent, condonationPercent: policy.condonationPercent, subjectMinPercent: policy.subjectMinPercent },
      ...summarize(list, entries),
      today: {
        date: today(), subjectCount: list.length, entered: savedToday,
        state: list.length === 0 ? 'no_subjects' : savedToday === 0 ? 'not_entered' : savedToday < list.length ? 'partial' : 'saved',
      },
    })
  })

  // Newest first. Only this student's entries for the current semester, with subject names.
  router.get('/attendance/history', async (req, res) => {
    const scope = await scopeOf(req, res); if (!scope) return
    const names = new Map(scope.list.map((s) => [s.id, s]))
    const entries = (await attendance.forSemester(req.user.id, scope.semester)).filter((e) => names.has(e.subjectId))
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500)
    res.json({
      entries: entries.slice(0, limit).map((e) => ({ date: e.date, code: names.get(e.subjectId).code, name: names.get(e.subjectId).name, conducted: e.conducted, attended: e.attended })),
      total: entries.length,
    })
  })

  router.get('/semesters', async (req, res) => {
    const withData = await attendance.semestersWithEntries(req.user.id)
    const available = [...new Set([...withData.filter((n) => n <= req.user.semester), req.user.semester])].sort((a, b) => b - a)
    res.json({ current: req.user.semester, available })
  })

  router.get('/attendance/stats', async (req, res) => {
    const scope = await scopeOf(req, res); if (!scope) return
    const entries = await attendance.forSemester(req.user.id, scope.semester)
    res.json({ semester: scope.semester, isCurrent: scope.isCurrent, ...statistics(scope.list, entries) })
  })

  // ---- Profile -------------------------------------------------------------------------
  router.patch('/profile', async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().replace(/\s+/g, ' ') : ''
    if (!name) return res.status(400).json({ message: 'Please fix the highlighted fields.', fieldErrors: { name: 'Please enter your full name.' } })
    if (name.length > 80) return res.status(400).json({ message: 'Please fix the highlighted fields.', fieldErrors: { name: 'Name must be 80 characters or fewer.' } })
    res.json({ user: publicUser(await users.updateProfile(req.user.id, { name })) })
  })

  // Moving up a semester. Forward only, and it never touches saved attendance: old entries stay
  // under their old semester number and the new semester simply starts empty.
  router.post('/semester', async (req, res) => {
    const year = Number(req.body?.year), semester = Number(req.body?.semester)
    const fail = (fieldErrors) => res.status(400).json({ message: 'Please fix the highlighted fields.', fieldErrors })
    if (!academics.years.includes(year)) return fail({ year: 'Choose a year.' })
    if (!semestersForYear(year).includes(semester)) return fail({ semester: 'That semester does not belong to the chosen year.' })
    if (semester === req.user.semester) return fail({ semester: 'That is already your current semester.' })
    if (semester < req.user.semester) return fail({ semester: 'You can only move forward. Ask an administrator if you chose the wrong semester earlier.' })
    res.json({ user: publicUser(await users.updateAcademic(req.user.id, { year, semester })), message: `You are now in semester ${semester}. Your earlier records are kept.` })
  })

  router.get('/attendance/predict', async (req, res) => {
    const t = parseTarget(req.query.target, policy.safePercent)
    if (!t.ok) return res.status(400).json({ message: 'Target must be a whole number from 1 to 100.' })
    const list = await mySubjects(req)
    const entries = await attendance.forSemester(req.user.id, req.user.semester)
    const s = summarize(list, entries)
    res.json({
      target: t.value,
      overall: { attended: s.overall.attended, conducted: s.overall.conducted, percentage: s.overall.percentage, safeLeave: safeLeave(s.overall.attended, s.overall.conducted, t.value), recovery: recovery(s.overall.attended, s.overall.conducted, t.value) },
      // Subject-level uses its own, separate minimum. It is never merged into the aggregate figure above.
      subjectMinimum: {
        target: policy.subjectMinPercent,
        subjects: s.subjects.map((x) => ({ code: x.code, name: x.name, attended: x.attended, conducted: x.conducted, percentage: x.percentage, belowMinimum: x.belowSubjectMinimum, recovery: recovery(x.attended, x.conducted, policy.subjectMinPercent) })),
      },
      noData: s.overall.status === STATUS.NO_DATA,
    })
  })


  // ---- Reminder email: verify an address, then switch reminders on or off ----------------------
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  const CODE_MINUTES = 15, MAX_ATTEMPTS = 5
  const hashCode = (userId, code) => createHmac('sha256', jwtSecret).update(`${userId}:${code}`).digest('hex')
  const mask = (e) => (e ? e.replace(/^(.).*?(@.*)$/, '$1***$2') : null)
  const emailLimiter = rateLimit({ ...emailLimit, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => `u:${req.user.id}`, message: { message: 'Too many code requests. Please try again later.' } })

  router.get('/reminders', (req, res) => {
    const u = req.user
    res.json({
      enabled: Boolean(u.remindersEnabled && u.emailVerified), email: mask(u.email), emailVerified: Boolean(u.emailVerified),
      pendingEmail: mask(u.pendingEmail), schedule: reminderConfig.slots.map((x) => x.id), skipsSundays: reminderConfig.skipWeekdays.includes(0),
      emailDelivery: mailer?.mode === 'resend' ? 'configured' : 'not_configured',
    })
  })

  router.post('/email', emailLimiter, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    if (!email || email.length > 254 || !EMAIL.test(email)) return res.status(400).json({ message: 'Please fix the highlighted fields.', fieldErrors: { email: 'That email address does not look right.' } })
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await users.setEmailChallenge(req.user.id, { email, codeHash: hashCode(req.user.id, code), expiresAt: new Date(now().getTime() + CODE_MINUTES * 60_000) })
    const sent = await mailer.send({ to: email, subject: 'Your AttendEase verification code', text: `Your AttendEase code is ${code}. It expires in ${CODE_MINUTES} minutes. If you did not ask for it, ignore this email.` })
    if (sent.accepted) return res.json({ message: `We sent a 6-digit code to ${mask(email)}. It expires in ${CODE_MINUTES} minutes.`, sent: true })
    // Never claim an email went out when it did not.
    return res.status(sent.mode === 'log' ? 200 : 502).json({
      sent: false,
      message: sent.mode === 'log'
        ? 'Email sending is not set up on this server yet, so no email was sent. An administrator needs to configure an email provider.'
        : 'We could not send the email right now. Please try again in a few minutes.',
    })
  })

  router.post('/email/verify', async (req, res) => {
    const u = req.user
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
    if (!u.pendingEmail || !u.codeHash) return res.status(400).json({ message: 'Ask for a new code first.' })
    if (new Date(u.codeExpiresAt) < now()) return res.status(400).json({ message: 'That code has expired. Ask for a new one.' })
    if ((u.codeAttempts || 0) >= MAX_ATTEMPTS) return res.status(429).json({ message: 'Too many wrong codes. Ask for a new code.' })
    await users.bumpCodeAttempts(u.id) // counted before comparing, so guessing cannot outrun the limit
    const given = Buffer.from(hashCode(u.id, code)), real = Buffer.from(u.codeHash)
    if (!/^\d{6}$/.test(code) || given.length !== real.length || !timingSafeEqual(given, real)) return res.status(400).json({ message: 'That code is not right.' })
    await users.confirmEmail(u.id)
    res.json({ message: 'Email verified. Reminders are on.' })
  })

  router.delete('/email', async (req, res) => { await users.removeEmail(req.user.id); res.json({ message: 'Email removed and reminders turned off.' }) })

  router.put('/reminders', async (req, res) => {
    if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ message: 'enabled must be true or false.' })
    if (req.body.enabled && !req.user.emailVerified) return res.status(400).json({ message: 'Verify an email address first.' })
    await users.setRemindersEnabled(req.user.id, req.body.enabled)
    res.json({ message: req.body.enabled ? 'Reminders are on.' : 'Reminders are off.' })
  })

  // ---- To-do list. Every call is scoped to req.user.id inside the repository. ----
  if (todos) {
    const badTodo = (res, fieldErrors) => res.status(400).json({ message: 'Please fix the highlighted fields.', fieldErrors })

    router.get('/todos', async (req, res) => {
      const status = ['pending', 'completed', 'all'].includes(req.query.status) ? req.query.status : 'all'
      res.json({ todos: await todos.list(req.user.id, status) })
    })
    router.post('/todos', async (req, res) => {
      const { ok, fieldErrors, value } = validateTodo(req.body)
      if (!ok) return badTodo(res, fieldErrors)
      const { completed: _c, completedAt: _a, ...fields } = value // new tasks always start as pending
      res.status(201).json({ todo: await todos.create(req.user.id, { description: '', dueDate: null, ...fields }) })
    })
    router.patch('/todos/:id', async (req, res) => {
      const { ok, fieldErrors, value } = validateTodo(req.body, { partial: true })
      if (!ok) return badTodo(res, fieldErrors)
      if (Object.keys(value).length === 0) return res.status(400).json({ message: 'Nothing to update.' })
      const todo = await todos.update(req.user.id, req.params.id, value)
      if (!todo) return res.status(404).json({ message: 'Task not found.' }) // also what you get for someone else's task
      res.json({ todo })
    })
    router.delete('/todos/:id', async (req, res) => {
      if (!(await todos.remove(req.user.id, req.params.id))) return res.status(404).json({ message: 'Task not found.' })
      res.json({ message: 'Task deleted.' })
    })
  }

  return router
}
