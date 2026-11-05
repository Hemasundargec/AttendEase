const CODE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,18}[A-Za-z0-9]$|^[A-Za-z0-9]$/

// A student adds a subject by name; the code is optional and made up from the name when left blank.
export function validateMySubject(body = {}) {
  const fieldErrors = {}
  const value = {}
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  if (!name) fieldErrors.name = 'Please enter the subject name.'
  else if (name.length > 100) fieldErrors.name = 'Subject name must be 100 characters or fewer.'
  else value.name = name
  const raw = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (raw) { if (CODE.test(raw)) value.code = raw; else fieldErrors.code = 'Subject code should be 1 to 20 letters, digits or - . _' }
  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors, value }
}

export const autoCode = (name) => {
  const letters = name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 6)
  return letters || 'SUB'
}

// days: { "1": [subjectId, ...], ... "7": [...] }, Monday = 1. Same subject may appear more than once a day.
export function validateTimetable(body, allowedIds, { maxPerDay = 10 } = {}) {
  const days = body && typeof body === 'object' ? body.days : null
  if (!days || typeof days !== 'object' || Array.isArray(days)) return { ok: false, message: 'Send the timetable as days 1 to 7.' }
  const allowed = new Set(allowedIds)
  const clean = {}
  for (let d = 1; d <= 7; d++) {
    const list = days[String(d)] ?? []
    if (!Array.isArray(list)) return { ok: false, message: 'Each day must be a list of subjects.' }
    if (list.length > maxPerDay) return { ok: false, message: `A day can have at most ${maxPerDay} periods.` }
    if (!list.every((id) => typeof id === 'string' && allowed.has(id))) return { ok: false, message: 'The timetable can only use your own subjects for this semester.' }
    clean[String(d)] = list
  }
  for (const k of Object.keys(days)) if (!/^[1-7]$/.test(k)) return { ok: false, message: 'Send the timetable as days 1 to 7.' }
  return { ok: true, days: clean }
}
