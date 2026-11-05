// Reminder schedule, all in India time (Asia/Kolkata). Change it here, nowhere else.
export const reminderConfig = {
  slots: [
    { id: '17:00', hour: 17, minute: 0 },
    { id: '20:00', hour: 20, minute: 0 },
    { id: '22:00', hour: 22, minute: 0 },
  ],
  // A slot is only sent within this many minutes after its time. It lets a restarted server catch up a
  // slot it just missed, but stops a 5 PM reminder arriving at midnight.
  graceMinutes: 30,
  // 0 = Sunday. No reminders on these days (students can still enter attendance).
  skipWeekdays: [0],
}
