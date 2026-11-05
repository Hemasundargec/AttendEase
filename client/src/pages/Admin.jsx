import { useEffect, useState } from 'react'
import Seo from '../components/Seo.jsx'
import Field from '../components/Field.jsx'
import { api } from '../lib/api.js'

const EMPTY = { code: '', name: '', college: '', regulation: '', branch: '', year: '', semester: '' }

export default function Admin() {
  const [overview, setOverview] = useState({ loading: true, error: '', data: null })
  const [options, setOptions] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState({ branch: '', semester: '' })

  const loadSubjects = async () => {
    const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString()
    const res = await api(`/api/admin/subjects${qs ? `?${qs}` : ''}`)
    if (res.ok) setSubjects(res.data.subjects)
  }

  useEffect(() => {
    api('/api/admin/overview').then((res) => setOverview(res.ok ? { loading: false, error: '', data: res.data } : { loading: false, error: res.data.message || 'Could not load the overview.', data: null }))
    api('/api/meta/academic-options').then((res) => {
      if (!res.ok) return
      setOptions(res.data)
      setValues((v) => ({ ...v, college: res.data.colleges[0].id, regulation: res.data.regulations[0].id }))
    })
  }, [])
  useEffect(() => { loadSubjects() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter])

  const set = (k) => (e) => setValues((v) => (k === 'year' ? { ...v, year: e.target.value, semester: '' } : { ...v, [k]: e.target.value }))

  const add = async (e) => {
    e.preventDefault(); setMessage(null); setBusy(true)
    const res = await api('/api/admin/subjects', { method: 'POST', body: { ...values, year: Number(values.year), semester: Number(values.semester) } })
    setBusy(false)
    if (res.ok) { setErrors({}); setMessage({ kind: 'ok', text: `Added ${res.data.subject.code}.` }); setValues((v) => ({ ...v, code: '', name: '' })); loadSubjects(); return }
    setErrors(res.data.fieldErrors || {}); setMessage({ kind: 'err', text: res.data.message || 'Could not add the subject.' })
  }

  const toggle = async (s) => {
    const res = await api(`/api/admin/subjects/${s.id}`, { method: 'PATCH', body: { active: !s.active } })
    if (res.ok) loadSubjects(); else setMessage({ kind: 'err', text: res.data.message || 'Could not update the subject.' })
  }

  const sems = values.year && options ? options.semestersByYear[values.year] : []
  const o = overview.data

  return (
    <div className="container section">
      <Seo path="/admin" />
      <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.4rem)' }}>Admin</h1>
      {overview.loading && <p role="status">Loading...</p>}
      {overview.error && <p className="status err" role="alert">{overview.error}</p>}
      {o && (
        <section className="card stack" aria-labelledby="ov">
          <h2 id="ov" style={{ fontSize: '1.2rem' }}>Overview</h2>
          <p><span className="big" style={{ display: 'inline' }}>{o.totalStudents}</span> registered students</p>
          {o.byBranchAndSemester.length > 0 && (
            <div className="table-wrap"><table className="plain">
              <thead><tr><th>Branch</th><th>Semester</th><th>Students</th></tr></thead>
              <tbody>{o.byBranchAndSemester.map((r) => <tr key={`${r.branch}-${r.semester}`}><td>{r.branch}</td><td>{r.semester}</td><td>{r.count}</td></tr>)}</tbody>
            </table></div>
          )}
        </section>
      )}

      {options && (
        <section className="card" aria-labelledby="addsub">
          <h2 id="addsub" style={{ fontSize: '1.2rem' }}>Add a subject</h2>
          <p className="small muted">Enter subjects exactly as your college lists them. AttendEase does not supply any official subject list.</p>
          <form className="form" onSubmit={add} noValidate style={{ maxWidth: 'none' }}>
            <div className="two-col">
              <Field id="code" label="Subject code" error={errors.code}><input id="code" type="text" maxLength={20} value={values.code} onChange={set('code')} aria-invalid={Boolean(errors.code)} /></Field>
              <Field id="sname" label="Subject name" error={errors.name}><input id="sname" type="text" maxLength={100} value={values.name} onChange={set('name')} aria-invalid={Boolean(errors.name)} /></Field>
              <Field id="abranch" label="Branch" error={errors.branch}>
                <select id="abranch" value={values.branch} onChange={set('branch')}><option value="">Choose...</option>{options.branches.map((b) => <option key={b.id} value={b.id}>{b.id}</option>)}</select></Field>
              <Field id="ayear" label="Year" error={errors.year}>
                <select id="ayear" value={values.year} onChange={set('year')}><option value="">Choose...</option>{options.years.map((y) => <option key={y} value={y}>Year {y}</option>)}</select></Field>
              <Field id="asem" label="Semester" error={errors.semester}>
                <select id="asem" value={values.semester} onChange={set('semester')} disabled={!values.year}><option value="">{values.year ? 'Choose...' : 'Pick a year first'}</option>{sems.map((s) => <option key={s} value={s}>Semester {s}</option>)}</select></Field>
            </div>
            {message && <p className={`status ${message.kind === 'ok' ? 'ok' : 'err'}`} role={message.kind === 'ok' ? 'status' : 'alert'}>{message.text}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Adding...' : 'Add subject'}</button>
          </form>
        </section>
      )}

      <section className="card" aria-labelledby="sublist">
        <h2 id="sublist" style={{ fontSize: '1.2rem' }}>Subjects</h2>
        {options && (
          <div className="controls">
            <div className="field"><label htmlFor="fb">Branch</label>
              <select id="fb" value={filter.branch} onChange={(e) => setFilter((f) => ({ ...f, branch: e.target.value }))}><option value="">All</option>{options.branches.map((b) => <option key={b.id} value={b.id}>{b.id}</option>)}</select></div>
            <div className="field"><label htmlFor="fs">Semester</label>
              <select id="fs" value={filter.semester} onChange={(e) => setFilter((f) => ({ ...f, semester: e.target.value }))}><option value="">All</option>{[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
        )}
        {subjects.length === 0 ? <p>No subjects yet.</p> : (
          <div className="table-wrap"><table className="plain">
            <thead><tr><th>Code</th><th>Name</th><th>Branch</th><th>Sem</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>{subjects.map((s) => (
              <tr key={s.id}><td>{s.code}</td><td>{s.name}</td><td>{s.branch}</td><td>{s.semester}</td><td>{s.active ? 'Active' : 'Deactivated'}</td>
                <td><button type="button" className="btn btn-quiet small-btn" onClick={() => toggle(s)}>{s.active ? 'Deactivate' : 'Reactivate'}</button></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  )
}
