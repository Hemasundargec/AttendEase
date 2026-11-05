import jwt from 'jsonwebtoken'
import { dueSlot, indiaClock, needsReminder, buildReminder } from './lib/reminders.js'
import { reminderConfig } from './config/reminders.js'

export const unsubscribeToken = (secret, userId) => jwt.sign({ sub: userId, purpose: 'unsubscribe' }, secret, { algorithm: 'HS256', expiresIn: '180d' })
export function readUnsubscribeToken(secret, token) {
  try { const p = jwt.verify(token, secret, { algorithms: ['HS256'] }); return p.purpose === 'unsubscribe' ? p.sub : null } catch { return null }
}

// One pass. Safe to call every minute: it does nothing unless a slot is due, and it can never send the same
// student the same slot twice. Returns counts so tests and logs can see exactly what happened.
export async function runReminderCheck({ users, subjects, attendance, logs, mailer, jwtSecret, siteUrl = '', now = new Date(), config = reminderConfig }) {
  const slot = dueSlot(now, config)
  const result = { slot, considered: 0, sent: 0, failed: 0, notDelivered: 0, skippedComplete: 0, skippedOther: 0, duplicates: 0 }
  if (!slot) return result
  const { date } = indiaClock(now)

  for (const user of await users.listReminderRecipients()) {
    result.considered += 1
    const list = await subjects.forStudent(user)
    const entries = await attendance.forDate(user.id, user.semester, date)
    const ids = new Set(list.map((s) => s.id))
    const entered = new Set(entries.filter((e) => ids.has(e.subjectId)).map((e) => e.subjectId)).size
    const decision = needsReminder({ subjectCount: list.length, enteredCount: entered })
    if (!decision.remind) { if (decision.reason === 'complete') result.skippedComplete += 1; else result.skippedOther += 1; continue }

    if (!(await logs.tryClaim(user.id, date, slot))) { result.duplicates += 1; continue } // already handled
    const link = siteUrl ? `${siteUrl.replace(/\/$/, '')}/api/reminders/unsubscribe?token=${encodeURIComponent(unsubscribeToken(jwtSecret, user.id))}` : ''
    const message = buildReminder({ name: user.name, state: decision.reason, entered, subjectCount: list.length, slot, unsubscribeUrl: link })
    const sent = await mailer.send({ to: user.email, ...message })
    if (sent.accepted) { result.sent += 1; await logs.setResult(user.id, date, slot, 'sent') }
    else if (sent.mode === 'log') { result.notDelivered += 1; await logs.setResult(user.id, date, slot, 'not_sent_no_provider') }
    else { result.failed += 1; await logs.setResult(user.id, date, slot, 'failed', sent.error) }
  }
  return result
}

// Checks every minute. unref() so it never keeps the process alive on its own.
export function startReminderScheduler(deps, { intervalMs = 60_000, logger = console } = {}) {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const r = await runReminderCheck({ ...deps, now: new Date() })
      if (r.slot && (r.sent || r.failed || r.notDelivered)) logger.log(`reminders ${r.slot}: sent=${r.sent} failed=${r.failed} not_sent_no_provider=${r.notDelivered}`)
    } catch (err) { logger.error('reminder check failed:', err.message) } finally { running = false }
  }
  const timer = setInterval(tick, intervalMs)
  timer.unref?.()
  return { stop: () => clearInterval(timer), tick }
}
