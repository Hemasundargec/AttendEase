import { COOKIE_NAME, readSession } from '../auth/session.js'

// Identity ALWAYS comes from the verified cookie and a fresh database lookup,
// never from an ID or role the browser sends in the request body or URL.
export const requireAuth = ({ users, jwtSecret }) => async (req, res, next) => {
  const payload = readSession(jwtSecret, req.cookies?.[COOKIE_NAME])
  if (!payload) return res.status(401).json({ message: 'Please log in to continue.' })
  const user = await users.findById(payload.sub)
  // tokenVersion changes on password change, which signs out every older session.
  if (!user || user.tokenVersion !== payload.tv) return res.status(401).json({ message: 'Your session has expired. Please log in again.' })
  req.user = user
  next()
}

export const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) return res.status(403).json({ message: 'You do not have access to this.' })
  next()
}

// CSRF defence in addition to SameSite=Lax: a state-changing request that carries an
// Origin header must come from this site (or an explicitly allowed origin).
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

export const sameOriginGuard = (allowedOrigins = [], { isProduction = false } = {}) => (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const origin = req.headers.origin
  if (!origin) return next() // non-browser clients and same-origin form posts without Origin
  let originHost
  let originHostname
  try { const u = new URL(origin); originHost = u.host; originHostname = u.hostname } catch { return res.status(403).json({ message: 'Request blocked.' }) }
  const forwarded = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim()
  if (originHost === req.headers.host || (forwarded && originHost === forwarded)) return next()
  if (allowedOrigins.includes(origin)) return next()
  // Local development only: the Vite dev server (5173) proxies to the API (4000), so the
  // browser Origin and the Host the API sees can differ. Never relaxed in production.
  if (!isProduction && LOOPBACK.has(originHostname)) return next()
  console.warn(`Request blocked: Origin=${origin} Host=${req.headers.host} X-Forwarded-Host=${forwarded || '-'} mode=${isProduction ? 'production' : 'development'}`)
  return res.status(403).json({ message: 'Request blocked.' })
}
