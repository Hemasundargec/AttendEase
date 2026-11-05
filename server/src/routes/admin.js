import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validateSubject } from '../validators/subject.js'
import { DuplicateSubjectError } from '../repos/errors.js'

// Every admin route sits behind login AND the admin role, checked on the server.
export function adminRoutes({ users, subjects, jwtSecret }) {
  const router = Router()
  router.use(requireAuth({ users, jwtSecret }), requireRole('admin'))

  router.get('/overview', async (_req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({
      totalStudents: await users.countStudents(),
      byBranchAndSemester: await users.countStudentsByBranchAndSemester(),
    })
  })

  // ---- Subject management -------------------------------------------------------------
  const dupMessage = { message: 'That subject code already exists for this college, regulation, branch and semester.', fieldErrors: { code: 'Already used in this semester.' } }
  const bad = (res, fieldErrors) => res.status(400).json({ message: 'Please fix the highlighted fields.', fieldErrors })

  router.get('/subjects', async (req, res) => {
    const { branch, year, semester, regulation, active } = req.query
    const filter = {
      branch: branch || undefined, regulation: regulation || undefined,
      year: year ? Number(year) : undefined, semester: semester ? Number(semester) : undefined,
      active: active === undefined ? undefined : active === 'true',
    }
    res.set('Cache-Control', 'no-store')
    res.json({ subjects: await subjects.list(filter) })
  })

  router.post('/subjects', async (req, res) => {
    const { ok, fieldErrors, value } = validateSubject(req.body)
    if (!ok) return bad(res, fieldErrors)
    try { res.status(201).json({ subject: await subjects.create(value) }) } catch (e) {
      if (e instanceof DuplicateSubjectError) return res.status(409).json(dupMessage)
      throw e
    }
  })

  router.patch('/subjects/:id', async (req, res) => {
    const existing = await subjects.findById(req.params.id)
    if (!existing) return res.status(404).json({ message: 'Subject not found.' })
    // Year and semester travel together because one is validated against the other.
    const merged = { ...existing, ...req.body }
    const { ok, fieldErrors, value } = validateSubject({ ...merged }, { partial: false })
    if (!ok) return bad(res, fieldErrors)
    try { res.json({ subject: await subjects.update(req.params.id, value) }) } catch (e) {
      if (e instanceof DuplicateSubjectError) return res.status(409).json(dupMessage)
      throw e
    }
  })

  return router
}
