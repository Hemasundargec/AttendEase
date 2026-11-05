import { randomUUID } from 'node:crypto'
import { DuplicateSubjectError } from './errors.js'

const sameSlot = (a, b) => a.college === b.college && a.regulation === b.regulation && a.branch === b.branch && a.semester === b.semester && a.code === b.code && (a.ownerId || null) === (b.ownerId || null)

export function createMemorySubjectRepo() {
  const subjects = new Map()
  const copy = (s) => (s ? { ...s } : null)
  return {
    kind: 'memory',
    async create(data) {
      if ([...subjects.values()].some((s) => sameSlot(s, data))) throw new DuplicateSubjectError()
      const now = new Date()
      const s = { id: randomUUID(), active: true, createdAt: now, updatedAt: now, ...data }
      subjects.set(s.id, s)
      return copy(s)
    },
    async findById(id) { return copy(subjects.get(String(id))) },
    async update(id, changes) {
      const s = subjects.get(String(id))
      if (!s) return null
      const next = { ...s, ...changes }
      if ([...subjects.values()].some((o) => o.id !== s.id && sameSlot(o, next))) throw new DuplicateSubjectError()
      Object.assign(s, changes, { updatedAt: new Date() })
      return copy(s)
    },
    // Administrator-managed subjects only, unless a filter names an ownerId (a student's own subjects).
    async list(filter = {}) {
      return [...subjects.values()]
        .filter((s) => (filter.ownerId === undefined ? !s.ownerId : true))
        .filter((s) => Object.entries(filter).every(([k, v]) => v === undefined || s[k] === v))
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(copy)
    },
    // Active subjects for one student's current academic details
    async forStudent(u) {
      const shared = await this.list({ college: u.college, regulation: u.regulation, branch: u.branch, year: u.year, semester: u.semester, active: true })
      const own = await this.list({ ownerId: u.id, semester: u.semester, active: true })
      return [...shared, ...own].sort((a, b) => a.code.localeCompare(b.code))
    },
    // Every subject (including deactivated ones) a student could have entries for in a semester.
    async forStudentSemester(u, semester) {
      const shared = await this.list({ college: u.college, regulation: u.regulation, branch: u.branch, semester })
      const own = await this.list({ ownerId: u.id, semester })
      return [...shared, ...own].sort((a, b) => a.code.localeCompare(b.code))
    },
    async countOwned(ownerId, semester) { return (await this.list({ ownerId, semester, active: true })).length },
  }
}
