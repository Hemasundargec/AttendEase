import { reminderConfig } from '../config/reminders.js'

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

// Clock parts in India time for any instant.
export function indiaClock(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(now).map((p) => [p.type, p.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute), weekday: WEEKDAYS[parts.weekday] }
}

// The slot that is due right now, or null. "Due" = its time has passed by no more than graceMinutes.
// If two slots qualify (only with a huge grace window) the latest wins, so one run sends at most one.
export function dueSlot(now = new Date(), config = reminderConfig) {
  const c = indiaClock(now)
  if (config.skipWeekdays.includes(c.weekday)) return null
  const minutesNow = c.hour * 60 + c.minute
  const due = config.slots
    .map((s) => ({ ...s, at: s.hour * 60 + s.minute }))
    .filter((s) => minutesNow >= s.at && minutesNow - s.at <= config.graceMinutes)
  return due.length ? due[due.length - 1].id : null
}

// Pure decision: does this student need a reminder right now?
//   subjectCount: subjects set up for their current semester
//   enteredCount: subjects with a saved entry TODAY (0 classes held counts as entered)
export function needsReminder({ subjectCount, enteredCount }) {
  if (subjectCount === 0) return { remind: false, reason: 'no_subjects' }
  if (enteredCount >= subjectCount) return { remind: false, reason: 'complete' }
  return { remind: true, reason: enteredCount === 0 ? 'not_entered' : 'partial' }
}

export function buildReminder({ name, state, entered, subjectCount, slot, unsubscribeUrl }) {
  const first = String(name).split(' ')[0]
  const what = state === 'partial'
    ? `You have entered ${entered} of ${subjectCount} subjects for today.`
    : "You haven't entered today's attendance yet."
  return {
    subject: 'AttendEase reminder: enter today\'s attendance',
    text: [
      `Hi ${first},`, '', what,
      'It takes under a minute: open AttendEase, choose Mark attendance, and save. If there were no classes today, enter 0 and 0 (or use "No classes today").',
      '', `(Reminder sent at ${slot} India time. You will not get more once today's entry is complete.)`, '',
      unsubscribeUrl ? `Turn reminders off: ${unsubscribeUrl}` : 'You can turn reminders off any time in Profile.',
      '', 'AttendEase is an independent student tool, not an official college record.',
    ].join('\n'),
  }
}
