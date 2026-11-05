// Pure validation, no framework code, so it is easy to unit-test.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateWaitlist(body) {
  const fieldErrors = {}
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!name) fieldErrors.name = 'Please enter your name.'
  else if (name.length > 80) fieldErrors.name = 'Name must be 80 characters or fewer.'

  if (!email) fieldErrors.email = 'Please enter your email address.'
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) fieldErrors.email = 'That email address does not look right.'

  if (body?.agreed !== true) fieldErrors.agreed = 'Please tick the box so we can email you about AttendEase.'

  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors, value: { name, email } }
}
