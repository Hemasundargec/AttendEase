import { test } from 'node:test'
import assert from 'node:assert/strict'
import { percentage, overallStatus, subjectBelowMinimum, safeLeave, recovery, summarize, STATUS, isValidDateString, dateProblem, todayInIndia, weekdayName } from '../src/lib/attendance.js'

test('percentage: normal, perfect, zero attended; null (not NaN) when nothing conducted', () => {
  assert.equal(percentage(3, 4), 75)
  assert.equal(percentage(4, 4), 100)
  assert.equal(percentage(0, 5), 0)
  assert.equal(percentage(1, 3), 33.33)
  assert.equal(percentage(0, 0), null)
})

test('percentage: rejects impossible counts', () => {
  assert.throws(() => percentage(5, 4), RangeError)
  assert.throws(() => percentage(-1, 4), RangeError)
  assert.throws(() => percentage(1.5, 4), RangeError)
  assert.throws(() => percentage('3', 4), RangeError)
})

test('overall status: exact boundaries 75% and 65%, just below each, and no data', () => {
  assert.equal(overallStatus(75, 100), STATUS.SAFE)         // exactly 75
  assert.equal(overallStatus(749, 1000), STATUS.CONDONATION) // 74.9
  assert.equal(overallStatus(65, 100), STATUS.CONDONATION)  // exactly 65
  assert.equal(overallStatus(649, 1000), STATUS.DETENTION_RISK) // 64.9
  assert.equal(overallStatus(0, 10), STATUS.DETENTION_RISK)
  assert.equal(overallStatus(0, 0), STATUS.NO_DATA)
  assert.equal(overallStatus(3, 4), STATUS.SAFE)            // 3/4 is exactly 75, no float trouble
})

test('subject minimum: exactly 40% is NOT a warning, below is, zero classes is not', () => {
  assert.equal(subjectBelowMinimum(2, 5), false)  // 40.0
  assert.equal(subjectBelowMinimum(39, 100), true)
  assert.equal(subjectBelowMinimum(0, 0), false)
  assert.equal(subjectBelowMinimum(0, 3), true)
})

test('safe leave: worked examples', () => {
  // 30/40 = 75% exactly. Missing 0 more is the limit.
  assert.deepEqual(safeLeave(30, 40, 75), { available: true, belowTarget: false, canMiss: 0 })
  // 36/40 = 90%: A/(T+x) >= .75 -> x <= 36/.75 - 40 = 8
  assert.equal(safeLeave(36, 40, 75).canMiss, 8)
  // verify the claim by brute force: 8 misses still passes, 9 fails
  assert.ok(36 * 100 >= 75 * (40 + 8)); assert.ok(36 * 100 < 75 * (40 + 9))
})

test('safe leave: already below target is never labelled safe; no classes is unavailable', () => {
  assert.deepEqual(safeLeave(29, 40, 75), { available: true, belowTarget: true, canMiss: 0 })
  assert.deepEqual(safeLeave(0, 0, 75), { available: false, reason: 'no_classes' })
})

test('safe leave: brute-force agreement over many inputs', () => {
  for (let T = 1; T <= 60; T++) for (let A = 0; A <= T; A++) for (const p of [40, 65, 75, 90, 100]) {
    const r = safeLeave(A, T, p)
    if (A * 100 < p * T) { assert.equal(r.belowTarget, true); continue }
    let x = 0
    while (A * 100 >= p * (T + x + 1)) x++
    assert.equal(r.canMiss, x, `A=${A} T=${T} p=${p}`)
  }
})

test('recovery: worked examples and exact-target case', () => {
  // 30/50 = 60%. (30+n)/(50+n) >= .75 -> n >= (37.5-30)/.25 = 30
  assert.equal(recovery(30, 50, 75).mustAttend, 30)
  assert.equal(recovery(30, 40, 75).mustAttend, 0) // already exactly at target
  assert.equal(recovery(40, 40, 75).mustAttend, 0)
})

test('recovery: 100% target is unreachable after any miss; zero classes unavailable', () => {
  assert.deepEqual(recovery(9, 10, 100), { available: true, reachable: false, reason: 'cannot_reach_100' })
  assert.equal(recovery(10, 10, 100).mustAttend, 0)
  assert.deepEqual(recovery(0, 0, 75), { available: false, reason: 'no_classes' })
})

test('recovery: brute-force agreement and minimality', () => {
  for (let T = 1; T <= 60; T++) for (let A = 0; A <= T; A++) for (const p of [40, 65, 75, 90]) {
    const r = recovery(A, T, p)
    let n = 0
    while ((A + n) * 100 < p * (T + n)) n++
    assert.equal(r.mustAttend, n, `A=${A} T=${T} p=${p}`)
    if (n > 0) assert.ok((A + n - 1) * 100 < p * (T + n - 1)) // one fewer is not enough
  }
})

test('targets must be whole numbers 1-100', () => {
  assert.throws(() => safeLeave(1, 2, 0), RangeError)
  assert.throws(() => recovery(1, 2, 101), RangeError)
  assert.throws(() => recovery(1, 2, 74.5), RangeError)
})

test('summarize: totals, missed, per-subject warning, ignores unknown subjects, zero-class days count as recorded', () => {
  const subjects = [{ id: 'm', code: 'MA', name: 'Maths' }, { id: 'p', code: 'PH', name: 'Physics' }]
  const entries = [
    { subjectId: 'm', attended: 2, conducted: 2 }, { subjectId: 'm', attended: 1, conducted: 2 },
    { subjectId: 'p', attended: 1, conducted: 5 }, { subjectId: 'p', attended: 0, conducted: 0 },
    { subjectId: 'gone', attended: 9, conducted: 9 },
  ]
  const s = summarize(subjects, entries)
  assert.equal(s.overall.attended, 4); assert.equal(s.overall.conducted, 9); assert.equal(s.overall.missed, 5)
  assert.equal(s.overall.percentage, 44.44); assert.equal(s.overall.status, STATUS.DETENTION_RISK)
  assert.equal(s.subjects[0].percentage, 75); assert.equal(s.subjects[0].status, STATUS.SAFE)
  assert.equal(s.subjects[1].daysRecorded, 2); assert.equal(s.subjects[1].belowSubjectMinimum, true)
  assert.deepEqual(s.subjectWarnings, ['PH'])
})

test('summarize: no entries gives NO_DATA and null percentages, never NaN', () => {
  const s = summarize([{ id: 'm', code: 'MA', name: 'Maths' }], [])
  assert.equal(s.overall.percentage, null); assert.equal(s.overall.status, STATUS.NO_DATA)
  assert.equal(s.subjects[0].percentage, null); assert.equal(s.subjects[0].belowSubjectMinimum, false)
})

test('dates: validity, future rejected, back-dating limit, India time zone', () => {
  assert.equal(isValidDateString('2026-02-29'), false)
  assert.equal(isValidDateString('2028-02-29'), true)
  assert.equal(isValidDateString('26-1-1'), false)
  assert.equal(dateProblem('2026-10-26', { today: '2026-10-25' }), 'You cannot enter attendance for a future date.')
  assert.equal(dateProblem('2026-10-25', { today: '2026-10-25' }), null)
  assert.equal(dateProblem('2026-04-28', { today: '2026-10-25', maxBackdateDays: 180 }), null) // exactly 180 days
  assert.match(dateProblem('2026-04-27', { today: '2026-10-25', maxBackdateDays: 180 }), /180 days/)
  // 20:00 UTC on 24 Oct is already 01:30 on 25 Oct in India
  assert.equal(todayInIndia(new Date('2026-10-24T20:00:00Z')), '2026-10-25')
  assert.equal(weekdayName('2026-10-25'), 'Sunday')
})
