import { Router } from 'express'
import { academics, semestersForYear } from '../config/academics.js'

export function metaRoutes() {
  const router = Router()
  // Public: the registration form builds its dropdowns from this so options live in one place.
  router.get('/academic-options', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300')
    res.json({ ...academics, semestersByYear: Object.fromEntries(academics.years.map((y) => [y, semestersForYear(y)])) })
  })
  return router
}
