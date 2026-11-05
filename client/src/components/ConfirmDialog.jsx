import { useEffect, useRef } from 'react'

// Accessible confirmation for destructive or hard-to-undo actions (uses the native <dialog>:
// focus is trapped, Escape closes it, and it announces itself to screen readers).
export default function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel, busy }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="dialog" aria-labelledby="dlg-title" onCancel={(e) => { e.preventDefault(); onCancel() }}>
      <h2 id="dlg-title" style={{ fontSize: '1.2rem' }}>{title}</h2>
      <div>{children}</div>
      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy}>{busy ? 'Working...' : confirmLabel}</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </dialog>
  )
}
