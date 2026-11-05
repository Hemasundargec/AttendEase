// One weekly timetable per student per semester: { 1: [subjectId, ...], ..., 7: [...] } (1 = Monday).
export function createMemoryTimetableRepo() {
  const rows = new Map()
  const key = (userId, semester) => `${userId}:${semester}`
  return {
    kind: 'memory',
    async get(userId, semester) { const r = rows.get(key(userId, semester)); return r ? JSON.parse(JSON.stringify(r.days)) : null },
    async set(userId, semester, days) { rows.set(key(userId, semester), { days: JSON.parse(JSON.stringify(days)) }); return days },
  }
}
