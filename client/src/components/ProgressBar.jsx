export default function ProgressBar({ percent, label }) {
  const value = percent === null || percent === undefined ? 0 : Math.max(0, Math.min(100, percent))
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
      <div className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  )
}
