import { useApi } from '../hooks.js'

// Lets a student look at an earlier semester. Hidden when there is only one to choose from.
export default function SemesterPicker({ value, onChange }) {
  const { data } = useApi('/api/student/semesters')
  if (!data || data.available.length < 2) return null
  const shown = value ?? data.current
  return (
    <div className="field" style={{ maxWidth: 260 }}>
      <label htmlFor="sem-pick">Semester</label>
      <select id="sem-pick" value={shown} onChange={(e) => onChange(Number(e.target.value) === data.current ? null : Number(e.target.value))}>
        {data.available.map((s) => <option key={s} value={s}>Semester {s}{s === data.current ? ' (current)' : ''}</option>)}
      </select>
    </div>
  )
}
