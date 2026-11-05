import { randomUUID } from 'node:crypto'

// One entry per student + subject + date + semester. Saving again REPLACES the numbers; it never duplicates.
export function createMemoryAttendanceRepo() {
  const entries = new Map()
  const key = (e) => `${e.userId}|${e.subjectId}|${e.date}|${e.semester}`
  const copy = (e) => ({ ...e })
  return {
    kind: 'memory',
    async upsertMany(userId, semester, date, rows) {
      const now = new Date()
      return rows.map((r) => {
        const k = key({ userId, subjectId: r.subjectId, date, semester })
        const existing = entries.get(k)
        if (existing) { Object.assign(existing, { conducted: r.conducted, attended: r.attended, updatedAt: now }); return copy(existing) }
        const e = { id: randomUUID(), userId, semester, date, subjectId: r.subjectId, conducted: r.conducted, attended: r.attended, createdAt: now, updatedAt: now }
        entries.set(k, e)
        return copy(e)
      })
    },
    async forDate(userId, semester, date) {
      return [...entries.values()].filter((e) => e.userId === userId && e.semester === semester && e.date === date).map(copy)
    },
    async forSemester(userId, semester) {
      return [...entries.values()].filter((e) => e.userId === userId && e.semester === semester).sort((a, b) => b.date.localeCompare(a.date)).map(copy)
    },
    async semestersWithEntries(userId) { return [...new Set([...entries.values()].filter((e) => e.userId === userId).map((e) => e.semester))].sort((a, b) => a - b) },
    async countAll() { return entries.size },
  }
}
