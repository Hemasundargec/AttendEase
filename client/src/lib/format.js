// Display helpers only. All attendance arithmetic is done by the server.
export const fmtPercent = (p) => (p === null || p === undefined ? 'Not available yet' : `${Number.isInteger(p) ? p : p.toFixed(2).replace(/0$/, '')}%`)

export const STATUS_INFO = {
  safe: { label: 'Safe', cls: 'st-safe', icon: 'check' },
  condonation: { label: 'Condonation range', cls: 'st-warn', icon: 'alert' },
  detention_risk: { label: 'Detention risk', cls: 'st-danger', icon: 'stop' },
  no_data: { label: 'No data yet', cls: 'st-none', icon: 'dash' },
}

// India calendar date (YYYY-MM-DD). Used only to bound the date picker; the server enforces the real rules.
export const todayIndia = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export const shiftDate = (ymd, days) => {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
