// Yearly attendance sheet: one row per day of month (1-31), one column per month (Jan-Dec).
// A day's mark comes from the classes entered for that date (all subjects added together):
//   P  = every class that day was attended        Pt = attended some, missed some
//   A  = classes were held and none attended      H  = no classes (Sunday, or a day entered as "no classes")
//   blank = nothing entered
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const daysInMonth = (year, month /* 1-12 */) => new Date(Date.UTC(year, month, 0)).getUTCDate()

export function dayMark({ conducted, attended } = {}, isSunday = false) {
  if (conducted === undefined) return isSunday ? 'H' : ''
  if (conducted === 0) return 'H'
  if (attended === conducted) return 'P'
  if (attended === 0) return 'A'
  return 'Pt'
}

// entries: [{ date: 'YYYY-MM-DD', conducted, attended }] (any subjects, any semesters)
export function buildSheet(entries, year) {
  const perDay = new Map()
  for (const e of entries) {
    if (!e.date.startsWith(`${year}-`)) continue
    const d = perDay.get(e.date) || { conducted: 0, attended: 0 }
    d.conducted += e.conducted; d.attended += e.attended
    perDay.set(e.date, d)
  }
  const totals = { present: 0, partial: 0, absent: 0, holiday: 0, classesConducted: 0, classesAttended: 0 }
  const rows = []
  for (let day = 1; day <= 31; day++) {
    const row = []
    for (let month = 1; month <= 12; month++) {
      if (day > daysInMonth(year, month)) { row.push(null); continue } // the date does not exist (e.g. 30 Feb)
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const isSunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0
      const mark = dayMark(perDay.get(date), isSunday)
      row.push(mark)
      if (mark === 'P') totals.present++
      else if (mark === 'Pt') totals.partial++
      else if (mark === 'A') totals.absent++
      else if (mark === 'H') totals.holiday++
    }
    rows.push(row)
  }
  for (const d of perDay.values()) { totals.classesConducted += d.conducted; totals.classesAttended += d.attended }
  return { year, months: MONTHS, rows, totals }
}
