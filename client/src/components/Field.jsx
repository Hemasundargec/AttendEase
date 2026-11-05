// Label + control + error message, wired together for screen readers.
export default function Field({ id, label, error, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="error" id={`${id}-err`}>{error}</p>}
    </div>
  )
}
export const describedBy = (id, error, hint) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined)
