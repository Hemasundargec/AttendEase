import mongoose from 'mongoose'

const todoSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 500 },
    dueDate: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
)
todoSchema.index({ userId: 1, completed: 1, dueDate: 1 })
const Todo = mongoose.models.Todo || mongoose.model('Todo', todoSchema)

const toPlain = (d) => { if (!d) return null; const o = d.toObject(); return { ...o, id: String(o._id), userId: String(o.userId), _id: undefined, __v: undefined } }
const ok = (id) => mongoose.isValidObjectId(id)

// Every query includes userId, so a task id from another user simply matches nothing.
export function createMongoTodoRepo() {
  return {
    kind: 'mongodb',
    async init() { await Todo.init() },
    async create(userId, data) { return toPlain(await Todo.create({ ...data, userId })) },
    async list(userId, status = 'all') {
      const q = { userId }
      if (status !== 'all') q.completed = status === 'completed'
      return (await Todo.find(q).sort({ dueDate: 1, createdAt: 1 })).map(toPlain)
    },
    async update(userId, id, changes) { return ok(id) ? toPlain(await Todo.findOneAndUpdate({ _id: id, userId }, changes, { new: true, runValidators: true })) : null },
    async remove(userId, id) { return ok(id) ? (await Todo.deleteOne({ _id: id, userId })).deletedCount === 1 : false },
  }
}
