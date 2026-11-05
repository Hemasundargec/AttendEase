// In-memory user store used by tests. Mirrors the contract of mongoUserRepo.js exactly.
import { randomUUID } from 'node:crypto'
import { DuplicateUserError } from './errors.js'

export function createMemoryUserRepo() {
  const users = new Map()
  const key = (college, rollNumber) => `${college}:${rollNumber}`
  const publicCopy = (u) => (u ? { ...u } : null)

  return {
    kind: 'memory',
    async findByRoll(college, rollNumber) {
      return publicCopy([...users.values()].find((u) => key(u.college, u.rollNumber) === key(college, rollNumber)))
    },
    async findById(id) { return publicCopy(users.get(String(id))) },
    async create(data) {
      if ([...users.values()].some((u) => key(u.college, u.rollNumber) === key(data.college, data.rollNumber))) {
        throw new DuplicateUserError()
      }
      const now = new Date()
      const user = { id: randomUUID(), tokenVersion: 0, createdAt: now, updatedAt: now, ...data }
      users.set(user.id, user)
      return publicCopy(user)
    },
    async updatePassword(id, passwordHash) {
      const u = users.get(String(id))
      if (!u) return null
      u.passwordHash = passwordHash
      u.tokenVersion += 1 // invalidates every session issued before the change
      u.updatedAt = new Date()
      return publicCopy(u)
    },
    async updateProfile(id, { name }) {
      const u = users.get(String(id)); if (!u) return null
      u.name = name; u.updatedAt = new Date(); return publicCopy(u)
    },
    async updateAcademic(id, { year, semester }) {
      const u = users.get(String(id)); if (!u) return null
      Object.assign(u, { year, semester, updatedAt: new Date() }); return publicCopy(u)
    },
    async setEmailChallenge(id, { email, codeHash, expiresAt }) {
      const u = users.get(String(id)); if (!u) return null
      Object.assign(u, { pendingEmail: email, codeHash, codeExpiresAt: expiresAt, codeAttempts: 0 }); return publicCopy(u)
    },
    async bumpCodeAttempts(id) { const u = users.get(String(id)); if (u) u.codeAttempts = (u.codeAttempts || 0) + 1; return publicCopy(u) },
    async confirmEmail(id) {
      const u = users.get(String(id)); if (!u || !u.pendingEmail) return null
      Object.assign(u, { email: u.pendingEmail, emailVerified: true, remindersEnabled: true, pendingEmail: null, codeHash: null, codeExpiresAt: null, codeAttempts: 0 }); return publicCopy(u)
    },
    async removeEmail(id) {
      const u = users.get(String(id)); if (!u) return null
      Object.assign(u, { email: null, emailVerified: false, remindersEnabled: false, pendingEmail: null, codeHash: null, codeExpiresAt: null }); return publicCopy(u)
    },
    async setRemindersEnabled(id, enabled) { const u = users.get(String(id)); if (!u) return null; u.remindersEnabled = enabled; return publicCopy(u) },
    async listReminderRecipients() { return [...users.values()].filter((u) => u.role === 'student' && u.remindersEnabled && u.emailVerified && u.email).map(publicCopy) },
    async countStudents() { return [...users.values()].filter((u) => u.role === 'student').length },
    async countStudentsByBranchAndSemester() {
      const counts = new Map()
      for (const u of users.values()) {
        if (u.role !== 'student') continue
        const k = `${u.branch}|${u.semester}`
        counts.set(k, (counts.get(k) || 0) + 1)
      }
      return [...counts].map(([k, count]) => { const [branch, semester] = k.split('|'); return { branch, semester: Number(semester), count } })
    },
  }
}
