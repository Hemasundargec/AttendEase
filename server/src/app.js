import express from 'express'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import { authRoutes } from './routes/auth.js'
import { adminRoutes } from './routes/admin.js'
import { metaRoutes } from './routes/meta.js'
import { studentRoutes } from './routes/student.js'
import { createMailer } from './mailer.js'
import { readUnsubscribeToken } from './reminderService.js'
import { sameOriginGuard } from './middleware/auth.js'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { validateWaitlist } from './validate.js'
import { issueFormToken, checkFormToken } from './formToken.js'
import { verifyTurnstile as defaultVerifyTurnstile } from './turnstile.js'

const SUCCESS_MESSAGE = 'You are on the list. We will email you when AttendEase opens.'

export function createApp({
  storage,
  users,
  subjects,
  attendance,
  todos,
  timetable,
  mailer = createMailer(),
  emailLimit,
  now,
  jwtSecret,
  allowedOrigins = [],
  loginLimit = { windowMs: 15 * 60 * 1000, max: 10 },
  registerLimit = { windowMs: 60 * 60 * 1000, max: 10 },
  distDir,
  formSecret,
  isProduction = false,
  canonicalHost = '', // e.g. attendease.example. Pins the redirect target so a forged Host header cannot be used
  turnstileSecret = '',
  verifyTurnstile = defaultVerifyTurnstile,
  signupLimit = { windowMs: 60 * 60 * 1000, max: 5 },
  minFormAgeMs = 3000,
} = {}) {
  if (users && !jwtSecret) throw new Error('jwtSecret is required when the users repository is enabled')
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1) // hosts like Render/Vercel sit behind one proxy and set X-Forwarded-*

  // 1) Force HTTPS in production. The health check is exempt so platform probes keep working.
  app.use((req, res, next) => {
    if (!isProduction || req.path === '/api/health') return next()
    if (req.secure) return next()
    return res.redirect(301, `https://${canonicalHost || req.headers.host}${req.originalUrl}`)
  })

  // 2) Security headers, including HSTS and a Content-Security-Policy that only allows what we use.
  app.use(
    helmet({
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: false },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://www.googletagmanager.com', 'https://challenges.cloudflare.com'],
          connectSrc: ["'self'", 'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com'],
          imgSrc: ["'self'", 'data:', 'https://*.google-analytics.com', 'https://*.googletagmanager.com'],
          frameSrc: ['https://challenges.cloudflare.com'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          // Only upgrade http->https subresources in production, otherwise plain-http local dev breaks.
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  )
  app.use(compression())
  app.use(express.json({ limit: '10kb' }))
  app.use(cookieParser())
  app.use('/api', sameOriginGuard(allowedOrigins, { isProduction }))

  // ---- API ---------------------------------------------------------------------------
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', storage: storage?.kind ?? 'none', build: 'login-fix-2' }))

  app.get('/api/form-token', (_req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({ token: issueFormToken(formSecret) })
  })

  const signupLimiter = rateLimit({
    ...signupLimit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many attempts. Please try again later.' },
  })

  app.post('/api/waitlist', signupLimiter, async (req, res) => {
    const body = req.body ?? {}

    // Spam layer 1: honeypot. Pretend success so bots learn nothing; store nothing.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return res.status(200).json({ message: SUCCESS_MESSAGE })
    }

    // Spam layer 2: signed timer token (too fast, forged or expired).
    const tokenProblem = checkFormToken(formSecret, body.formToken, { minAgeMs: minFormAgeMs })
    if (tokenProblem) {
      const message =
        tokenProblem === 'too-fast'
          ? 'That was very quick. Please wait a moment and submit again.'
          : 'This form expired. Please reload the page and try again.'
      return res.status(400).json({ message })
    }

    // Spam layer 3 (optional): Cloudflare Turnstile.
    if (turnstileSecret) {
      const human = await verifyTurnstile(turnstileSecret, body.turnstileToken, req.ip)
      if (!human) return res.status(400).json({ message: 'The human check failed. Please try again.' })
    }

    const { ok, fieldErrors, value } = validateWaitlist(body)
    if (!ok) return res.status(400).json({ message: 'Please fix the highlighted fields.', fieldErrors })

    try {
      await storage.addSignup(value)
      // Same reply whether new or already on the list, so nobody can probe who has signed up.
      return res.status(201).json({ message: SUCCESS_MESSAGE })
    } catch (err) {
      console.error('waitlist save failed:', err.message)
      return res.status(500).json({ message: 'We could not save your details. Please try again in a moment.' })
    }
  })

  if (users) {
    app.use('/api/auth', authRoutes({ users, jwtSecret, isProduction, loginLimit, registerLimit }))
    if (subjects) app.use('/api/admin', adminRoutes({ users, subjects, jwtSecret }))
    else app.use('/api/admin', adminRoutes({ users, subjects: null, jwtSecret }))
    if (subjects && attendance) app.use('/api/student', studentRoutes({ users, subjects, attendance, todos, timetable, mailer, jwtSecret, now, emailLimit }))
  }
  app.use('/api/meta', metaRoutes())

  // One-click unsubscribe from the link in a reminder email. The signed token proves which student it is.
  if (users) {
    app.get('/api/reminders/unsubscribe', async (req, res) => {
      const userId = readUnsubscribeToken(jwtSecret, String(req.query.token || ''))
      const page = (title, body) => res.status(userId ? 200 : 400).type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:system-ui,sans-serif;background:#6F4E37;color:#E5E4E2;padding:32px;max-width:560px;margin:auto"><h1>${title}</h1><p>${body}</p><p><a style="color:#E6E0F0" href="/">Back to AttendEase</a></p>`)
      if (!userId) return page('Link not valid', 'This unsubscribe link is invalid or has expired. You can turn reminders off in Profile after logging in.')
      await users.setRemindersEnabled(userId, false)
      return page('Reminders turned off', 'You will not get any more reminder emails. You can turn them back on in Profile.')
    })
  }

  app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found.' }))

  // ---- Static site -------------------------------------------------------------------
  if (distDir && existsSync(distDir)) {
    // Pages that exist only inside the React app. A refresh or bookmark on these must load the app shell,
    // not a 404. Anything NOT listed here and not a real file still gets a true 404.
    const APP_ROUTES = ['/dashboard', '/attendance', '/attendance/mark', '/attendance/predict', '/statistics', '/todos', '/profile', '/timetable', '/admin']
    app.get(APP_ROUTES, (_req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(join(distDir, 'index.html')) })
    app.use(
      express.static(distDir, {
        extensions: ['html'], // /privacy -> privacy.html
        redirect: false,
        setHeaders(res, filePath) {
          if (filePath.includes(`${join('assets')}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          else if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache')
          else res.setHeader('Cache-Control', 'public, max-age=86400')
        },
      }),
    )
    // Anything else is a real 404 status with the custom 404 page.
    app.use((_req, res) => res.status(404).sendFile(join(distDir, '404.html')))
  }

  // Safe error handler: no stack traces to visitors.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
      return res.status(400).json({ message: 'Invalid request.' })
    }
    console.error(err)
    res.status(500).json({ message: 'Something went wrong on our side.' })
  })

  return app
}
