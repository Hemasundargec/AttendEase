import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { hashPassword, verifyPassword, verifyAgainstDummy } from '../auth/password.js'
import { COOKIE_NAME, cookieOptions, signSession } from '../auth/session.js'
import { validateRegistration, validateLogin, validatePasswordChange } from '../validators/auth.js'
import { DuplicateUserError } from '../repos/errors.js'
import { requireAuth } from '../middleware/auth.js'

// Only fields the browser needs. Never the password hash or tokenVersion.
export const publicUser = (u) => ({
  id: u.id, name: u.name, rollNumber: u.rollNumber, role: u.role, college: u.college,
  regulation: u.regulation ?? null, branch: u.branch ?? null, year: u.year ?? null, semester: u.semester ?? null,
})

export function authRoutes({ users, jwtSecret, isProduction, loginLimit, registerLimit }) {
  const router = Router()
  const limiter = (opts, message) => rateLimit({ ...opts, standardHeaders: true, legacyHeaders: false, message: { message } })
  const loginLimiter = limiter(loginLimit, 'Too many login attempts. Please wait a few minutes and try again.')
  const registerLimiter = limiter(registerLimit, 'Too many sign-up attempts. Please try again later.')
  const setSession = (res, user) => res.cookie(COOKIE_NAME, signSession(jwtSecret, user), cookieOptions(isProduction))

  router.post('/register', registerLimiter, async (req, res) => {
    const { ok, fieldErrors, value } = validateRegistration(req.body)
    if (!ok) return res.status(400).json({ message: 'Please fix the highlighted fields.', fieldErrors })

    const { password, ...profile } = value
    // role is fixed here on the server. Whatever the browser sends as "role" is ignored.
    const toCreate = { ...profile, role: 'student', passwordHash: await hashPassword(password) }
    try {
      const user = await users.create(toCreate)
      setSession(res, user)
      return res.status(201).json({ user: publicUser(user) })
    } catch (err) {
      if (err instanceof DuplicateUserError) {
        return res.status(409).json({ message: 'An account with this roll number already exists.', fieldErrors: { rollNumber: 'This roll number is already registered.' } })
      }
      throw err
    }
  })

  router.post('/login', loginLimiter, async (req, res) => {
    const { ok, value } = validateLogin(req.body)
    const fail = () => res.status(401).json({ message: 'Incorrect roll number or password.' })
    if (!ok) return fail()
    const user = await users.findByRoll(value.college, value.rollNumber)
    if (!user) { await verifyAgainstDummy(value.password); return fail() }
    if (!(await verifyPassword(value.password, user.passwordHash))) return fail()
    setSession(res, user)
    return res.json({ user: publicUser(user) })
  })

  router.post('/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions(isProduction), maxAge: undefined })
    res.json({ message: 'Logged out.' })
  })

  const auth = requireAuth({ users, jwtSecret })
  router.get('/me', auth, (req, res) => { res.set('Cache-Control', 'no-store'); res.json({ user: publicUser(req.user) }) })

  router.post('/change-password', auth, async (req, res) => {
    const { ok, fieldErrors } = validatePasswordChange(req.body, req.user.rollNumber)
    if (!ok) return res.status(400).json({ message: 'Please fix the highlighted fields.', fieldErrors })
    if (!(await verifyPassword(req.body.currentPassword, req.user.passwordHash))) {
      return res.status(400).json({ message: 'Please fix the highlighted fields.', fieldErrors: { currentPassword: 'That is not your current password.' } })
    }
    const updated = await users.updatePassword(req.user.id, await hashPassword(req.body.newPassword))
    setSession(res, updated) // keep THIS device signed in; all other sessions are now invalid
    res.json({ message: 'Password changed. Other devices have been signed out.' })
  })

  return router
}
