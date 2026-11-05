import { isValidDateString } from '../lib/attendance.js'

const PRIORITIES = ['low', 'medium', 'high']

// partial=true is used for PATCH: only fields that were sent are checked and returned.
export function validateTodo(body = {}, { partial = false } = {}) {
  const fieldErrors = {}
  const value = {}
  const has = (k) => body[k] !== undefined
  const need = (k) => !partial || has(k)

  if (need('title')) {
    const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : ''
    if (!title) fieldErrors.title = 'Please enter a title.'
    else if (title.length > 120) fieldErrors.title = 'Title must be 120 characters or fewer.'
    else value.title = title
  }
  if (has('description')) {
    if (typeof body.description !== 'string' || body.description.length > 500) fieldErrors.description = 'Description must be 500 characters or fewer.'
    else value.description = body.description.trim()
  }
  if (has('dueDate')) {
    if (body.dueDate === null || body.dueDate === '') value.dueDate = null
    else if (!isValidDateString(body.dueDate)) fieldErrors.dueDate = 'Please choose a valid due date.'
    else value.dueDate = body.dueDate
  }
  if (has('priority') || !partial) {
    const p = body.priority === undefined ? 'medium' : body.priority
    if (!PRIORITIES.includes(p)) fieldErrors.priority = 'Priority must be low, medium or high.'
    else value.priority = p
  }
  if (has('completed')) {
    if (typeof body.completed !== 'boolean') fieldErrors.completed = 'Completed must be true or false.'
    else { value.completed = body.completed; value.completedAt = body.completed ? new Date() : null }
  }
  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors, value }
}
