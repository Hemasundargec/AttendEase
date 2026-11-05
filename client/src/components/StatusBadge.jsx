import { CheckCircle2, AlertTriangle, OctagonAlert, MinusCircle } from 'lucide-react'
import { STATUS_INFO } from '../lib/format.js'

const ICONS = { check: CheckCircle2, alert: AlertTriangle, stop: OctagonAlert, dash: MinusCircle }

// Colour AND icon AND text, so the meaning never depends on colour alone.
export default function StatusBadge({ status }) {
  const info = STATUS_INFO[status] || STATUS_INFO.no_data
  const Icon = ICONS[info.icon]
  return <span className={`badge ${info.cls}`}><Icon size={16} aria-hidden="true" />{info.label}</span>
}
