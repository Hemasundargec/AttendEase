// The ONLY place attendance thresholds live. Change them here (an admin screen can write to this later).
// These are the policy numbers you supplied for SRGEC. Official rules always take precedence.
export const policy = {
  safePercent: 75,          // aggregate >= 75  -> SAFE
  condonationPercent: 65,   // aggregate >= 65 and < 75 -> CONDONATION RANGE, below 65 -> DETENTION RISK
  subjectMinPercent: 40,    // any single subject below 40 -> subject warning
  maxBackdateDays: 180,     // how far back a student may enter or correct attendance
}
