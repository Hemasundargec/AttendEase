import { useEffect, useState } from 'react'
import Seo from '../components/Seo.jsx'
import Field, { describedBy } from '../components/Field.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import ReminderSettings from '../components/ReminderSettings.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'

export default function Profile() {
  const { user, refresh } = useAuth()
  const [options, setOptions] = useState(null)
  const [name, setName] = useState(user.name)
  const [nameMsg, setNameMsg] = useState(null)
  const [nameErr, setNameErr] = useState('')
  const [target, setTarget] = useState({ year: '', semester: '' })
  const [semErr, setSemErr] = useState({})
  const [semMsg, setSemMsg] = useState(null)
  const [confirmSem, setConfirmSem] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwErr, setPwErr] = useState({})
  const [pwMsg, setPwMsg] = useState(null)

  useEffect(() => { api('/api/meta/academic-options').then((r) => r.ok && setOptions(r.data)) }, [])

  const saveName = async (e) => {
    e.preventDefault(); setNameMsg(null); setNameErr('')
    if (!name.trim()) { setNameErr('Please enter your full name.'); return }
    const res = await api('/api/student/profile', { method: 'PATCH', body: { name } })
    if (res.ok) { await refresh(); setNameMsg({ kind: 'ok', text: 'Name updated.' }) } else setNameErr(res.data.fieldErrors?.name || res.data.message || 'Could not update your name.')
  }

  const askSemester = (e) => {
    e.preventDefault(); setSemMsg(null)
    const found = {}
    if (!target.year) found.year = 'Choose a year.'
    if (!target.semester) found.semester = 'Choose a semester.'
    else if (Number(target.semester) === user.semester) found.semester = 'That is already your current semester.'
    else if (Number(target.semester) < user.semester) found.semester = 'You can only move forward.'
    setSemErr(found)
    if (Object.keys(found).length === 0) setConfirmSem(true)
  }
  const doSemester = async () => {
    setBusy(true)
    const res = await api('/api/student/semester', { method: 'POST', body: { year: Number(target.year), semester: Number(target.semester) } })
    setBusy(false); setConfirmSem(false)
    if (res.ok) { await refresh(); setTarget({ year: '', semester: '' }); setSemMsg({ kind: 'ok', text: res.data.message }) }
    else { setSemErr(res.data.fieldErrors || {}); setSemMsg({ kind: 'err', text: res.data.message || 'Could not change semester.' }) }
  }

  const savePw = async (e) => {
    e.preventDefault(); setPwMsg(null)
    const found = {}
    if (!pw.currentPassword) found.currentPassword = 'Please enter your current password.'
    if (pw.newPassword.length < 8 || !/[A-Za-z]/.test(pw.newPassword) || !/\d/.test(pw.newPassword)) found.newPassword = 'At least 8 characters with a letter and a number.'
    else if (pw.newPassword !== pw.confirmPassword) found.confirmPassword = 'Passwords do not match.'
    setPwErr(found)
    if (Object.keys(found).length) return
    const res = await api('/api/auth/change-password', { method: 'POST', body: pw })
    if (res.ok) { setPw({ currentPassword: '', newPassword: '', confirmPassword: '' }); setPwMsg({ kind: 'ok', text: res.data.message }) }
    else { setPwErr(res.data.fieldErrors || {}); setPwMsg({ kind: 'err', text: res.data.message || 'Could not change your password.' }) }
  }

  const sems = target.year && options ? options.semestersByYear[target.year] : []
  const Msg = ({ m }) => m && <p className={`status ${m.kind === 'ok' ? 'ok' : 'err'}`} role={m.kind === 'ok' ? 'status' : 'alert'}>{m.text}</p>

  return (
    <div className="container section">
      <Seo path="/profile" />
      <h1 style={{ fontSize: 'clamp(1.7rem, 5vw, 2.4rem)' }}>Profile</h1>

      <section className="card stack" aria-labelledby="p-info">
        <h2 id="p-info" style={{ fontSize: '1.2rem' }}>Your details</h2>
        <dl className="details">
          <div><dt>Roll number</dt><dd>{user.rollNumber}</dd></div>
          <div><dt>College</dt><dd>{user.college}</dd></div>
          <div><dt>Branch</dt><dd>{user.branch}</dd></div>
          <div><dt>Regulation</dt><dd>{user.regulation}</dd></div>
          <div><dt>Year</dt><dd>{user.year}</dd></div>
          <div><dt>Semester</dt><dd>{user.semester}</dd></div>
        </dl>
        <p className="small muted">Your roll number, college and branch cannot be changed here. If one is wrong, ask an administrator.</p>
      </section>

      <section className="card" aria-labelledby="p-name">
        <h2 id="p-name" style={{ fontSize: '1.2rem' }}>Name</h2>
        <form className="form" onSubmit={saveName} noValidate>
          <Field id="name" label="Full name" error={nameErr}>
            <input id="name" type="text" maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(nameErr)} aria-describedby={describedBy('name', nameErr)} />
          </Field>
          <Msg m={nameMsg} />
          <button className="btn btn-primary" type="submit">Save name</button>
        </form>
      </section>

      <section className="card" aria-labelledby="p-sem">
        <h2 id="p-sem" style={{ fontSize: '1.2rem' }}>Move to a new semester</h2>
        <p className="small muted">Your attendance for earlier semesters is kept and stays viewable. The new semester starts with no entries. You can only move forward.</p>
        {options && (
          <form className="form" onSubmit={askSemester} noValidate>
            <div className="two-col">
              <Field id="sy" label="Year" error={semErr.year}>
                <select id="sy" value={target.year} onChange={(e) => setTarget({ year: e.target.value, semester: '' })}><option value="">Choose...</option>{options.years.map((y) => <option key={y} value={y}>Year {y}</option>)}</select></Field>
              <Field id="ss" label="Semester" error={semErr.semester}>
                <select id="ss" value={target.semester} onChange={(e) => setTarget({ ...target, semester: e.target.value })} disabled={!target.year}><option value="">{target.year ? 'Choose...' : 'Pick a year first'}</option>{sems.map((s) => <option key={s} value={s}>Semester {s}</option>)}</select></Field>
            </div>
            <Msg m={semMsg} />
            <button className="btn btn-primary" type="submit">Change semester</button>
          </form>
        )}
      </section>

      <ReminderSettings />

      <section className="card" aria-labelledby="p-pw">
        <h2 id="p-pw" style={{ fontSize: '1.2rem' }}>Change password</h2>
        <form className="form" onSubmit={savePw} noValidate>
          <Field id="cp" label="Current password" error={pwErr.currentPassword}><input id="cp" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} aria-invalid={Boolean(pwErr.currentPassword)} /></Field>
          <Field id="np" label="New password" error={pwErr.newPassword} hint="At least 8 characters with a letter and a number."><input id="np" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} aria-invalid={Boolean(pwErr.newPassword)} /></Field>
          <Field id="cnp" label="Confirm new password" error={pwErr.confirmPassword}><input id="cnp" type="password" autoComplete="new-password" value={pw.confirmPassword} onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })} aria-invalid={Boolean(pwErr.confirmPassword)} /></Field>
          <Msg m={pwMsg} />
          <button className="btn btn-primary" type="submit">Change password</button>
        </form>
        <p className="small muted" style={{ marginTop: 12 }}>Changing your password signs you out on your other devices.</p>
      </section>

      <ConfirmDialog open={confirmSem} title={`Move to semester ${target.semester}?`} confirmLabel="Yes, change semester" busy={busy} onConfirm={doSemester} onCancel={() => setConfirmSem(false)}>
        <p>You are in semester {user.semester} now. Your records for it will be kept, and you will start semester {target.semester} with no entries. You cannot move back.</p>
      </ConfirmDialog>
    </div>
  )
}
