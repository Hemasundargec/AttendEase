import { randomUUID } from 'node:crypto'

// Every method takes userId first and only ever touches that user's tasks.
export function createMemoryTodoRepo() {
  const todos = new Map()
  const copy = (t) => (t ? { ...t } : null)
  const mine = (userId, id) => { const t = todos.get(String(id)); return t && t.userId === userId ? t : null }
  return {
    kind: 'memory',
    async create(userId, data) {
      const now = new Date()
      const t = { id: randomUUID(), userId, completed: false, completedAt: null, createdAt: now, updatedAt: now, ...data }
      todos.set(t.id, t)
      return copy(t)
    },
    async list(userId, status = 'all') {
      return [...todos.values()]
        .filter((t) => t.userId === userId && (status === 'all' || (status === 'completed') === t.completed))
        .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.createdAt - b.createdAt)
        .map(copy)
    },
    async update(userId, id, changes) {
      const t = mine(userId, id)
      if (!t) return null
      Object.assign(t, changes, { updatedAt: new Date() })
      return copy(t)
    },
    async remove(userId, id) { return mine(userId, id) ? todos.delete(String(id)) : false },
  }
}
