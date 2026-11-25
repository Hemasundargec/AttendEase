import { dateProblem, isValidDateString } from '../lib/attendance.js'

// Strict whole number: rejects 1.5, "2", null, NaN, negatives, and absurdly large values.
const isWholeCount = (n) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 20

// body: { entries: [{ subjectId, conducted, attended }] }
// allowedSubjectIds: the ids of the student's OWN active subjects for the current semester.
// periodCounts: null when the student has no timetable for this weekday, otherwise { subjectId: periods that day }.
// With a timetable, a subject can never have more classes conducted than periods scheduled for it that day.
export const MAX_CLASSES_PER_DAY = 10

export function validateDailyEntries(body, allowedSubjectIds, { periodCounts = null } = {}) {
  const rowErrors = {}
  const rows = []
  if (!body || !Array.isArray(body.entries) || body.entries.length === 0) {
    return { ok: false, message: 'No attendance was submitted.', rowErrors, rows }
  }
  if (body.entries.length > allowedSubjectIds.length) return { ok: false, message: 'Too many entries.', rowErrors, rows }
  const seen = new Set()
  for (const raw of body.entries) {
    const id = typeof raw?.subjectId === 'string' ? raw.subjectId : ''
    if (!allowedSubjectIds.includes(id)) return { ok: false, message: 'One of the subjects is not part of your current semester.', rowErrors, rows }
    if (seen.has(id)) return { ok: false, message: 'A subject was submitted twice.', rowErrors, rows }
    seen.add(id)
    const { conducted, attended } = raw
    if (!isWholeCount(conducted)) rowErrors[id] = 'Classes conducted must be a whole number from 0 to 20.'
    else if (!isWholeCount(attended)) rowErrors[id] = 'Classes attended must be a whole number from 0 to 20.'
    else if (attended > conducted) rowErrors[id] = 'Attended cannot be more than conducted.'
    else if (periodCounts && conducted > (periodCounts[id] || 0)) {
      const n = periodCounts[id] || 0
      rowErrors[id] = n === 0 ? 'This subject is not on your timetable for this day, so no class can be counted.' : `Your timetable has only ${n} class${n === 1 ? '' : 'es'} of this subject on this day.`
    } else rows.push({ subjectId: id, conducted, attended })
  }
  if (Object.keys(rowErrors).length === 0 && rows.reduce((t, r) => t + r.conducted, 0) > MAX_CLASSES_PER_DAY) {
    return { ok: false, message: `A day can have at most ${MAX_CLASSES_PER_DAY} classes in total.`, rowErrors, rows }
  }
  const ok = Object.keys(rowErrors).length === 0
  return { ok, message: ok ? '' : 'Please fix the highlighted subjects.', rowErrors, rows }
}

export const validateDateParam = (date, opts) => dateProblem(date, opts)
export { isValidDateString }

// Targets are whole numbers 1-100.
export function parseTarget(raw, fallback) {
  if (raw === undefined || raw === '') return { ok: true, value: fallback }
  if (!/^\d{1,3}$/.test(String(raw))) return { ok: false }
  const n = Number(raw)
  return n >= 1 && n <= 100 ? { ok: true, value: n } : { ok: false }
}
