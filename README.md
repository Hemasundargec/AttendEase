# AttendEase: public site and launch checklist

React + Vite front end (`client/`) and Express API (`server/`).

Built so far: the public site, **authentication**, **subjects** (admin adds/deactivates them),
**daily attendance entry** (save, correct, no duplicates), **subject-wise and overall percentages with
SAFE / CONDONATION / DETENTION-RISK status and the 40% subject warning**, a **history** view, and
**safe-leave and recovery calculators**.
Also built: **statistics** (trend chart with a table alternative, subject comparison, month by month,
highest/lowest subject), a **to-do list** (add, edit, complete, delete with confirmation), and a
**profile page** (change name and password, move to a new semester).
Also built: **email reminders** (see below).
Not built yet: profile pictures, admin student search and settings screen, and the final deployment steps.

### Reminders
- Schedule lives in `server/src/config/reminders.js`: 5:00 PM, then 8:00 PM and 10:00 PM, India time, none on Sundays.
- A server-side scheduler checks every minute, so it works with every browser closed. Before each reminder it looks at today's saved
  entries and sends nothing if every subject is entered. Entering 0 and 0 ("No classes on this day") counts as entered.
- Each student can get at most one email per slot per day. The database enforces this, so it is safe to run more than one server copy.
- A student adds an email, receives a 6-digit code (valid 15 minutes, 5 tries, 5 requests per hour), and reminders turn on only after it is verified.
  Every email has a one-click unsubscribe link (set `SITE_URL`). Reminders can also be switched off in Profile.
- **Email delivery needs setup.** Create a Resend account, verify a sending domain, and set `RESEND_API_KEY` and `MAIL_FROM`.
  Without them the server logs messages instead of sending, the app tells the student "no email was sent", and the log records
  `not_sent_no_provider`. A provider failure is recorded as `failed` and is not retried for that slot.
- Reminders cannot be tested end to end against a real inbox here; the tests use a fake provider that records messages.

### Semesters
- Moving up a semester is forward-only, needs a confirmation, and never edits saved attendance.
- Attendance is stored under its semester number, so earlier semesters stay viewable (semester picker on
  Show attendance and Statistics). Subjects retired later still count in their old semester's history.
- The new semester starts empty and uses the subjects configured for it.

### To-do list
Every operation is scoped to the logged-in student inside the data layer, so another student's task id just returns "not found".

### Attendance rules (all enforced on the server)
- Counts are whole numbers 0-20; attended cannot exceed conducted. No future dates; edits allowed up to 180 days back.
- One entry per student + subject + date + semester (database unique index). Saving again replaces the numbers.
- A subject you leave blank is "not entered"; entering 0 and 0 means "no class held". Neither counts as an absence.
- Records are keyed by semester, so old semesters stay separate when the semester changes later.
- Thresholds (75 / 65 / 40, 180 days) live in one file: `server/src/config/policy.js`.
- All arithmetic is in `server/src/lib/attendance.js` and is covered by tests, including brute-force checks.
- The MongoDB versions of the subject and attendance stores are written but have only been tested through the in-memory versions. Run `TEST_MONGODB_URI=... npm test` against a throwaway database before relying on them.

## Run locally

```bash
npm run install:all
cp server/.env.example server/.env        # optional in development
cp client/.env.example client/.env        # optional in development
npm run dev:server                        # http://localhost:4000
npm run dev:client                        # http://localhost:5173 (proxies /api to the server)
```

Without `MONGODB_URI`, development mode writes signups to `server/data/waitlist.jsonl` and keeps
user accounts **in memory** (they disappear when the server restarts). Production refuses to start
without MongoDB, `FORM_SECRET` and `JWT_SECRET`.

## Authentication

- Passwords are hashed with bcrypt (cost 12). Roll numbers are stored uppercase, unique per college.
- Login is a signed token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production). The browser JavaScript never sees it.
- Who you are and your role are always read from the database on the server, never from the request.
- Changing a password signs out every other device. Login and sign-up are rate limited.
- There is no public admin signup. Create the first administrator from a terminal:

```bash
cd server && MONGODB_URI="your-atlas-uri" node scripts/create-admin.js
```

- The branch list in `server/src/config/academics.js` is a **placeholder**: edit it to match SRGEC's real branches.
- Optional real-database test: `TEST_MONGODB_URI="..." npm test` (use a throwaway database).

## Build and serve like production

```bash
VITE_SITE_URL=https://your-domain.example npm run build   # also writes sitemap.xml, robots.txt, per-page meta
NODE_ENV=production npm start                             # serves client/dist and the API
npm test                                                  # server tests
```

## Environment variables

| Where | Name | Purpose |
|---|---|---|
| client | `VITE_SITE_URL` | Public URL used in canonical links, sitemap, social tags |
| client | `VITE_GA_ID` | Google Analytics 4 ID (`G-XXXXXXXXXX`). Loads only after consent |
| client | `VITE_TURNSTILE_SITE_KEY` | Optional Cloudflare Turnstile **site** key (public) |
| server | `MONGODB_URI` | MongoDB Atlas connection string (required in production) |
| server | `FORM_SECRET` | Signs the anti-spam form token (required in production) |
| server | `JWT_SECRET` | Signs login cookies, 32+ characters, different from FORM_SECRET (required in production) |
| server | `ALLOWED_ORIGINS` | Optional extra origins allowed to call the API |
| server | `BCRYPT_COST` | Password hashing cost, default 12 |
| server | `CANONICAL_HOST` | Your hostname, pins the HTTP to HTTPS redirect target |
| server | `TURNSTILE_SECRET` | Optional Turnstile **secret** key (server only) |

Only values that are safe to be public may start with `VITE_`; they are baked into the browser bundle.

## Before you launch (things only you can do)

1. Replace `contactEmail` in `client/src/siteConfig.js` and set the real `VITE_SITE_URL`.
2. Have the Privacy Policy and Terms reviewed. They are templates, not legal advice.
3. Create a GA4 property and set `VITE_GA_ID`, then rebuild.
4. Host behind HTTPS (Render, Vercel, etc.), set `NODE_ENV=production` and the server variables above.
5. Submit `/sitemap.xml` to Google Search Console.
6. Run Lighthouse / PageSpeed Insights on the live URL.

## Regenerating images

`python3 tools/make_assets.py` rebuilds the favicon set, `og-image.png` and `hero-dashboard.webp` (needs Pillow).

## Troubleshooting

**Login/register says "Request blocked."** The server rejects state-changing requests whose browser `Origin` isn't this site (CSRF protection). In development this was triggered by the Vite proxy; it is fixed — update to the latest files and **restart both** `npm run dev:server` and `npm run dev:client`. In production, set `ALLOWED_ORIGINS` to your site URL(s) if the site is reached through a different hostname than the one the server sees.

**Run locally:** terminal 1 `npm run dev:server` (port 4000), terminal 2 `npm run dev:client`, then open http://localhost:5173. Without `MONGODB_URI` data is kept in memory and is lost when the server restarts.

## Your own subjects and timetable

After logging in, a student opens **Timetable** to add their own subjects (private to them, up to 15 per semester) and set the periods for each weekday. On **Mark**, today's periods appear as rows: tick **Class happened**, then **I attended**. Ticks are saved as conducted/attended counts, so Statistics, Prediction and reminders work unchanged. "Enter numbers instead" is still available. Administrator-added subjects for a branch and semester still appear too.
