// Login sessions: a signed JWT kept in an HttpOnly cookie (JavaScript on the page can never read it).
import jwt from 'jsonwebtoken'

export const COOKIE_NAME = 'attendease_session'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export const cookieOptions = (isProduction) => ({
  httpOnly: true,
  secure: isProduction, // HTTPS only in production
  sameSite: 'lax',
  path: '/',
  maxAge: MAX_AGE_MS,
})

export const signSession = (secret, user) =>
  jwt.sign({ sub: user.id, tv: user.tokenVersion, role: user.role }, secret, { algorithm: 'HS256', expiresIn: Math.floor(MAX_AGE_MS / 1000) })

// Returns the payload or null. Algorithm is pinned so a forged "alg: none" token is refused.
export function readSession(secret, token) {
  if (!token) return null
  try { return jwt.verify(token, secret, { algorithms: ['HS256'] }) } catch { return null }
}
