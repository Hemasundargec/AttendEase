// One row per student + date + slot. tryClaim() is atomic, so two ticks (or two servers) can never both send.
export function createMemoryReminderLogRepo() {
  const rows = new Map()
  const key = (u, d, s) => `${u}|${d}|${s}`
  return {
    kind: 'memory',
    async tryClaim(userId, date, slot) {
      const k = key(userId, date, slot)
      if (rows.has(k)) return false
      rows.set(k, { userId, date, slot, status: 'claimed', detail: '', at: new Date() })
      return true
    },
    async setResult(userId, date, slot, status, detail = '') { const r = rows.get(key(userId, date, slot)); if (r) Object.assign(r, { status, detail }) },
    async list() { return [...rows.values()].map((r) => ({ ...r })) },
  }
}
