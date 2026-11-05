import { academics, semestersForYear, hasId } from '../config/academics.js'

const ROLL_PATTERN = /^[A-Z0-9][A-Z0-9-]{3,28}[A-Z0-9]$/ // 5-30 chars, letters/digits/hyphen

export const normalizeRoll = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '')

// bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated.
export function validatePassword(password, { minLength = 8, rollNumber = '' } = {}) {
  if (typeof password !== 'string' || password.length === 0) return 'Please enter a password.'
  if (password.length < minLength) return `Password must be at least ${minLength} characters.`
  if (Buffer.byteLength(password, 'utf8') > 72) return 'Password must be 72 bytes or fewer.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must contain at least one letter and one number.'
  if (rollNumber && password.toUpperCase().includes(rollNumber)) return 'Password must not contain your roll number.'
  return null
}

export function validateRegistration(body = {}) {
  const fieldErrors = {}
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  const rollNumber = normalizeRoll(body.rollNumber)
  const college = typeof body.college === 'string' ? body.college : ''
  const regulation = typeof body.regulation === 'string' ? body.regulation : ''
  const branch = typeof body.branch === 'string' ? body.branch : ''
  const year = Number(body.year)
  const semester = Number(body.semester)

  if (!name) fieldErrors.name = 'Please enter your full name.'
  else if (name.length > 80) fieldErrors.name = 'Name must be 80 characters or fewer.'

  if (!rollNumber) fieldErrors.rollNumber = 'Please enter your roll number.'
  else if (!ROLL_PATTERN.test(rollNumber)) fieldErrors.rollNumber = 'Roll number should be 5 to 30 letters or digits.'

  if (!hasId(academics.colleges, college)) fieldErrors.college = 'Please choose a college from the list.'
  if (!hasId(academics.regulations, regulation)) fieldErrors.regulation = 'Please choose a regulation from the list.'
  if (!hasId(academics.branches, branch)) fieldErrors.branch = 'Please choose a branch from the list.'
  if (!academics.years.includes(year)) fieldErrors.year = 'Please choose your year of study.'
  else if (!semestersForYear(year).includes(semester)) fieldErrors.semester = 'That semester does not belong to the chosen year.'
  else if (!Number.isInteger(semester)) fieldErrors.semester = 'Please choose your semester.'

  const passwordProblem = validatePassword(body.password, { rollNumber })
  if (passwordProblem) fieldErrors.password = passwordProblem
  if (!fieldErrors.password && body.password !== body.confirmPassword) fieldErrors.confirmPassword = 'Passwords do not match.'

  return {
    ok: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    value: { name, rollNumber, college, regulation, branch, year, semester, password: body.password },
  }
}

export function validateLogin(body = {}) {
  const rollNumber = normalizeRoll(body.rollNumber)
  const college = typeof body.college === 'string' && body.college ? body.college : academics.colleges[0].id
  const password = typeof body.password === 'string' ? body.password : ''
  const ok = Boolean(rollNumber) && password.length > 0 && password.length <= 200
  return { ok, value: { rollNumber, college, password } }
}

export function validatePasswordChange(body = {}, rollNumber) {
  const fieldErrors = {}
  if (typeof body.currentPassword !== 'string' || !body.currentPassword) fieldErrors.currentPassword = 'Please enter your current password.'
  const problem = validatePassword(body.newPassword, { rollNumber })
  if (problem) fieldErrors.newPassword = problem
  else if (body.newPassword === body.currentPassword) fieldErrors.newPassword = 'Choose a password different from the current one.'
  else if (body.newPassword !== body.confirmPassword) fieldErrors.confirmPassword = 'Passwords do not match.'
  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors }
}
