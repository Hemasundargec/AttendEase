import { academics, semestersForYear, hasId } from '../config/academics.js'

const CODE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,18}[A-Za-z0-9]$|^[A-Za-z0-9]$/

export function validateSubject(body = {}, { partial = false } = {}) {
  const fieldErrors = {}
  const value = {}
  const has = (k) => body[k] !== undefined
  const need = (k) => !partial || has(k)

  if (need('code')) {
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    if (!CODE.test(code)) fieldErrors.code = 'Subject code should be 1 to 20 letters, digits or - . _'
    else value.code = code
  }
  if (need('name')) {
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
    if (!name) fieldErrors.name = 'Please enter the subject name.'
    else if (name.length > 100) fieldErrors.name = 'Subject name must be 100 characters or fewer.'
    else value.name = name
  }
  if (need('college')) { if (hasId(academics.colleges, body.college)) value.college = body.college; else fieldErrors.college = 'Choose a college from the list.' }
  if (need('regulation')) { if (hasId(academics.regulations, body.regulation)) value.regulation = body.regulation; else fieldErrors.regulation = 'Choose a regulation from the list.' }
  if (need('branch')) { if (hasId(academics.branches, body.branch)) value.branch = body.branch; else fieldErrors.branch = 'Choose a branch from the list.' }
  if (need('year') || need('semester')) {
    const year = Number(body.year), semester = Number(body.semester)
    if (!academics.years.includes(year)) fieldErrors.year = 'Choose a year.'
    else if (!semestersForYear(year).includes(semester)) fieldErrors.semester = 'That semester does not belong to the chosen year.'
    else { value.year = year; value.semester = semester }
  }
  if (has('active')) { if (typeof body.active === 'boolean') value.active = body.active; else fieldErrors.active = 'Active must be true or false.' }
  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors, value }
}
