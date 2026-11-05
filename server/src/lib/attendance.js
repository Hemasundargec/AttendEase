// All attendance arithmetic lives here and nowhere else. Pure functions, no database, no Express.
// Comparisons use integers (attended * 100 >= percent * conducted) so there are no floating-point
// surprises at exact boundaries like 75.0% or 40.0%.
import { policy as defaultPolicy } from '../config/policy.js'

export const STATUS = { SAFE: 'safe', CONDONATION: 'condonation', DETENTION_RISK: 'detention_risk', NO_DATA: 'no_data' }

const isCount = (n) => Number.isInteger(n) && n >= 0

// Percentage rounded to 2 decimals for DISPLAY only. Returns null when no classes were conducted.
export function percentage(attended, conducted) {
  if (!isCount(attended) || !isCount(conducted) || attended > conducted) throw new RangeError('invalid attendance counts')
  if (conducted === 0) return null
  return Math.round((attended / conducted) * 10000) / 100
}

export const meetsPercent = (attended, conducted, percent) => conducted > 0 && attended * 100 >= percent * conducted

export function overallStatus(attended, conducted, policy = defaultPolicy) {
  if (conducted === 0) return STATUS.NO_DATA
  if (meetsPercent(attended, conducted, policy.safePercent)) return STATUS.SAFE
  if (meetsPercent(attended, conducted, policy.condonationPercent)) return STATUS.CONDONATION
  return STATUS.DETENTION_RISK
}

// Subject-level warning: strictly BELOW the minimum. Exactly 40% is not a warning.
export const subjectBelowMinimum = (attended, conducted, policy = defaultPolicy) =>
  conducted > 0 && attended * 100 < policy.subjectMinPercent * conducted

// Most extra classes that can be missed while staying at or above the target.
//   A / (T + x) >= p   =>   x <= A/p - T
export function safeLeave(attended, conducted, targetPercent) {
  assertTarget(targetPercent)
  if (conducted === 0) return { available: false, reason: 'no_classes' }
  if (!meetsPercent(attended, conducted, targetPercent)) return { available: true, belowTarget: true, canMiss: 0 }
  // floor(100A / target) - T, using integer division (all values are integers)
  const canMiss = Math.floor((attended * 100) / targetPercent) - conducted
  return { available: true, belowTarget: false, canMiss }
}

// Fewest consecutive classes to attend (and not miss any) to reach the target.
//   (A + n) / (T + n) >= p   =>   n >= (p*T - A) / (1 - p)
export function recovery(attended, conducted, targetPercent) {
  assertTarget(targetPercent)
  if (conducted === 0) return { available: false, reason: 'no_classes' }
  if (meetsPercent(attended, conducted, targetPercent)) return { available: true, reachable: true, mustAttend: 0 }
  if (targetPercent === 100) return { available: true, reachable: false, reason: 'cannot_reach_100' } // one miss is permanent
  const needed = targetPercent * conducted - 100 * attended
  const mustAttend = Math.ceil(needed / (100 - targetPercent))
  return { available: true, reachable: true, mustAttend }
}

function assertTarget(t) {
  if (!Number.isInteger(t) || t < 1 || t > 100) throw new RangeError('target must be a whole number from 1 to 100')
}

// Combine raw entries into per-subject and overall totals. `subjects` decides which subjects count
// and in what order; entries for other subjects (e.g. deactivated) are ignored.
export function summarize(subjects, entries, policy = defaultPolicy) {
  const totals = new Map(subjects.map((s) => [s.id, { attended: 0, conducted: 0, days: 0 }]))
  for (const e of entries) {
    const t = totals.get(e.subjectId)
    if (!t) continue
    t.attended += e.attended; t.conducted += e.conducted; t.days += 1
  }
  const perSubject = subjects.map((s) => {
    const { attended, conducted, days } = totals.get(s.id)
    return {
      subjectId: s.id, code: s.code, name: s.name, attended, conducted, missed: conducted - attended, daysRecorded: days,
      percentage: conducted === 0 ? null : percentage(attended, conducted),
      belowSubjectMinimum: subjectBelowMinimum(attended, conducted, policy),
      status: conducted === 0 ? STATUS.NO_DATA : overallStatus(attended, conducted, policy),
    }
  })
  const attended = perSubject.reduce((n, s) => n + s.attended, 0)
  const conducted = perSubject.reduce((n, s) => n + s.conducted, 0)
  return {
    overall: {
      attended, conducted, missed: conducted - attended,
      percentage: conducted === 0 ? null : percentage(attended, conducted),
      status: overallStatus(attended, conducted, policy),
    },
    subjects: perSubject,
    subjectWarnings: perSubject.filter((s) => s.belowSubjectMinimum).map((s) => s.code),
  }
}

// ---- dates (all in India time, because that is when classes happen) ----
const ymd = /^(\d{4})-(\d{2})-(\d{2})$/
export function isValidDateString(s) {
  const m = typeof s === 'string' && ymd.exec(s)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}
export const todayInIndia = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
const dayNumber = (s) => Math.floor(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000)
export const daysBetween = (from, to) => dayNumber(to) - dayNumber(from)
export const weekdayName = (s) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${s}T00:00:00Z`).getUTCDay()]

// null when fine, otherwise a message for the student.
export function dateProblem(dateStr, { today = todayInIndia(), maxBackdateDays = defaultPolicy.maxBackdateDays } = {}) {
  if (!isValidDateString(dateStr)) return 'Please choose a valid date.'
  if (dateStr > today) return 'You cannot enter attendance for a future date.'
  if (daysBetween(dateStr, today) > maxBackdateDays) return `You can only enter or correct attendance up to ${maxBackdateDays} days back.`
  return null
}

// ---- statistics: everything is derived from saved entries; nothing is invented or padded ----
export function statistics(subjects, entries, policy = defaultPolicy) {
  const base = summarize(subjects, entries, policy)
  const valid = new Set(subjects.map((s) => s.id))
  const mine = entries.filter((e) => valid.has(e.subjectId))

  const withClasses = base.subjects.filter((s) => s.conducted > 0)
  // Highest/lowest compare exact fractions (a/b vs c/d by cross-multiplying) so ties are real ties.
  const cmp = (x, y) => x.attended * y.conducted - y.attended * x.conducted
  const sorted = [...withClasses].sort((x, y) => cmp(y, x) || x.code.localeCompare(y.code))
  const pick = (s) => (s ? { code: s.code, name: s.name, percentage: s.percentage } : null)

  const byDate = new Map()
  for (const e of mine) {
    const d = byDate.get(e.date) || { attended: 0, conducted: 0 }
    d.attended += e.attended; d.conducted += e.conducted; byDate.set(e.date, d)
  }
  const dates = [...byDate.keys()].sort()
  let ca = 0, cc = 0
  const trend = dates.map((date) => {
    const d = byDate.get(date); ca += d.attended; cc += d.conducted
    return { date, dayAttended: d.attended, dayConducted: d.conducted, attended: ca, conducted: cc, percentage: cc === 0 ? null : percentage(ca, cc) }
  })

  const months = new Map()
  for (const date of dates) {
    const k = date.slice(0, 7), d = byDate.get(date), m = months.get(k) || { attended: 0, conducted: 0, days: 0 }
    m.attended += d.attended; m.conducted += d.conducted; m.days += 1; months.set(k, m)
  }
  const monthly = [...months].map(([month, m]) => ({ month, ...m, percentage: m.conducted === 0 ? null : percentage(m.attended, m.conducted) }))

  return {
    ...base,
    highest: pick(sorted[0]),
    lowest: sorted.length > 1 ? pick(sorted[sorted.length - 1]) : null, // one subject cannot be both best and worst
    daysRecorded: dates.length,
    trend,
    monthly,
  }
}
