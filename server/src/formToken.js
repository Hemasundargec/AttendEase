// Signed "form opened at" timestamp. Bots that post instantly (or replay an old token)
// are rejected, and unlike a client-supplied timer it cannot be faked without the secret.
import { createHmac, timingSafeEqual } from 'node:crypto'

const sign = (secret, issuedAt) => createHmac('sha256', secret).update(String(issuedAt)).digest('hex')

export function issueFormToken(secret, now = Date.now()) {
  return `${now}.${sign(secret, now)}`
}

// Returns null when fine, otherwise a short reason string.
export function checkFormToken(secret, token, { minAgeMs = 3000, maxAgeMs = 2 * 60 * 60 * 1000, now = Date.now() } = {}) {
  if (typeof token !== 'string' || !token.includes('.')) return 'missing'
  const [issuedAt, signature] = token.split('.')
  const expected = sign(secret, issuedAt)
  const a = Buffer.from(signature || '', 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return 'invalid'
  const age = now - Number(issuedAt)
  if (!Number.isFinite(age) || age < minAgeMs) return 'too-fast'
  if (age > maxAgeMs) return 'expired'
  return null
}
