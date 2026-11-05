import { useEffect, useState } from 'react'
import Seo from '../components/Seo.jsx'
import Field from '../components/Field.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { api } from '../lib/api.js'
import { todayIndia } from '../lib/format.js'

const EMPTY = { title: '', description: '', dueDate: '', priority: 'medium' }
const PRIORITY = { high: 'High', medium: 'Medium', low: 'Low' }

export default function Todos() {
  const [todos, setTodos] = useState(null)
  const [error, setError] = useState('')
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null) // { id, ...fields }
  const [editErrors, setEditErrors] = useState({})
  const [toDelete, setToDelete] = useState(null)
  const today = todayIndia()

  const load = async () => {
    const res = await api('/api/student/todos')
    if (res.ok) { setTodos(res.data.todos); setError('') } else setError(res.data.message || 'Could not load your tasks.')
  }
  useEffect(() => { load() }, [])

  const body = (v) => ({ title: v.title, description: v.description, dueDate: v.dueDate || null, priority: v.priority })

  const add = async (e) => {
    e.preventDefault()
    if (!values.title.trim()) { setErrors({ title: 'Please enter a title.' }); return }
    setBusy(true)
    const res = await api('/api/student/todos', { method: 'POST', body: body(values) })
    setBusy(false)
    if (res.ok) { setValues(EMPTY); setErrors({}); load() } else { setErrors(res.data.fieldErrors || {}); setError(res.data.message || '') }
  }

  // Optimistic: the checkbox flips immediately, then we confirm with the server and undo if it failed.
  const toggle = async (t) => {
    const flip = (completed) => setTodos((list) => list.map((x) => (x.id === t.id ? { ...x, completed } : x)))
    flip(!t.completed)
    const res = await api(`/api/student/todos/${t.id}`, { method: 'PATCH', body: { completed: !t.completed } })
    if (res.ok) { setError(''); load() } else { flip(t.completed); setError(res.data.message || 'Could not update the task, so it was put back.') }
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editing.title.trim()) { setEditErrors({ title: 'Please enter a title.' }); return }
    const res = await api(`/api/student/todos/${editing.id}`, { method: 'PATCH', body: body(editing) })
    if (res.ok) { setEditing(null); setEditErrors({}); load() } else setEditErrors(res.data.fieldErrors || { title: res.data.message })
  }

  const confirmDelete = async () => {
    setBusy(true)
    const res = await api(`/api/student/todos/${toDelete.id}`, { method: 'DELETE' })
    setBusy(false); setToDelete(null)
    if (res.ok) load(); else setError(res.data.message || 'Could not delete the task.')
  }

  const pending = (todos ?? []).filter((t) => !t.completed)
  const done = (todos ?? []).filter((t) => t.completed)

  const Item = ({ t }) => (
    <li className="todo card">
      {editing?.id === t.id ? (
        <form className="form" onSubmit={saveEdit} noValidate style={{ maxWidth: 'none' }}>
          <Field id={`et-${t.id}`} label="Title" error={editErrors.title}>
            <input id={`et-${t.id}`} type="text" maxLength={120} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} aria-invalid={Boolean(editErrors.title)} />
          </Field>
          <div className="two-col">
            <Field id={`ed-${t.id}`} label="Due date" error={editErrors.dueDate}><input id={`ed-${t.id}`} type="date" value={editing.dueDate} onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })} /></Field>
            <Field id={`ep-${t.id}`} label="Priority"><select id={`ep-${t.id}`} value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value })}>
              {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          </div>
          <div className="row"><button className="btn btn-primary small-btn" type="submit">Save</button>
            <button className="btn btn-quiet small-btn" type="button" onClick={() => { setEditing(null); setEditErrors({}) }}>Cancel</button></div>
        </form>
      ) : (
        <>
          <label className="check todo-main">
            <input type="checkbox" checked={t.completed} onChange={() => toggle(t)} />
            <span>
              <strong className={t.completed ? 'struck' : ''}>{t.title}</strong>
              {t.description && <span className="small muted block">{t.description}</span>}
              <span className="small muted block">
                {PRIORITY[t.priority]} priority
                {t.dueDate && <> &middot; Due {t.dueDate}{!t.completed && t.dueDate < today && <strong className="st-danger"> (overdue)</strong>}</>}
              </span>
            </span>
          </label>
          <div className="row">
            <button type="button" className="btn btn-quiet small-btn" onClick={() => { setEditing({ id: t.id, title: t.title, description: t.description || '', dueDate: t.dueDate || '', priority: t.priority }); setEditErrors({}) }}>Edit<span className="sr-only"> {t.title}</span></button>
            <button type="button" className="btn btn-quiet small-btn" onClick={() => setToDelete(t)}>Delete<span className="sr-only"> {t.title}</span></button>
          </div>
        </>
      )}
    </li>
  )

  return (
    <div className="container section">
      <Seo path="/todos" />
      <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.4rem)' }}>To-do list</h1>

      <form className="card form" onSubmit={add} noValidate style={{ maxWidth: 'none' }}>
        <Field id="t-title" label="New task" error={errors.title}>
          <input id="t-title" type="text" maxLength={120} placeholder="e.g. Submit Python assignment" value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} aria-invalid={Boolean(errors.title)} />
        </Field>
        <div className="two-col">
          <Field id="t-due" label="Due date (optional)" error={errors.dueDate}><input id="t-due" type="date" value={values.dueDate} onChange={(e) => setValues({ ...values, dueDate: e.target.value })} /></Field>
          <Field id="t-pri" label="Priority"><select id="t-pri" value={values.priority} onChange={(e) => setValues({ ...values, priority: e.target.value })}>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>Add task</button>
      </form>

      {error && <p className="status err" role="alert" style={{ marginTop: 18 }}>{error}</p>}
      {todos === null && !error && <p role="status">Loading...</p>}

      {todos && (
        <>
          <h2 style={{ fontSize: '1.3rem', marginTop: 28 }}>Pending ({pending.length})</h2>
          {pending.length === 0 ? <p>Nothing pending. Add a task above.</p> : <ul className="todo-list">{pending.map((t) => <Item key={t.id} t={t} />)}</ul>}
          <h2 style={{ fontSize: '1.3rem', marginTop: 28 }}>Completed ({done.length})</h2>
          {done.length === 0 ? <p>No completed tasks yet.</p> : <ul className="todo-list">{done.map((t) => <Item key={t.id} t={t} />)}</ul>}
        </>
      )}

      <ConfirmDialog open={Boolean(toDelete)} title="Delete this task?" confirmLabel="Delete task" busy={busy} onConfirm={confirmDelete} onCancel={() => setToDelete(null)}>
        <p>"{toDelete?.title}" will be removed. This cannot be undone.</p>
      </ConfirmDialog>
    </div>
  )
}
