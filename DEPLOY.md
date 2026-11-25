# Putting AttendEase online (so every student can use it)

Local development keeps data in memory, so it disappears on restart. For real students you need a **database (MongoDB Atlas, free)** and a **host (Render, free)**.

## 1. Database: MongoDB Atlas
1. Create a free account and a free **M0** cluster at https://www.mongodb.com/atlas.
2. Database Access: create a user with a strong password.
3. Network Access: allow `0.0.0.0/0` (Render's addresses change).
4. Connect, Drivers: copy the connection string (`mongodb+srv://...`), replace `<password>`, and add a database name: `.../attendease?retryWrites=true&w=majority`.
5. **Test the database code once from your laptop** (this checks every repository against real MongoDB):
   ```
   cd server
   set TEST_MONGODB_URI=mongodb+srv://...   (PowerShell: $env:TEST_MONGODB_URI="mongodb+srv://...")
   npm test
   ```
   The two "mongo" tests should now run instead of being skipped. They clean up after themselves; use a throwaway database name such as `attendease_test`.

## 2. Host: Render
1. Push is already done: the code is at https://github.com/Hemasundargec/AttendEase.
2. On https://render.com choose **New, Blueprint**, pick the repo (it reads `render.yaml`).
3. Fill the prompted values: `MONGODB_URI`, and your site address for `VITE_SITE_URL`, `SITE_URL`, `CANONICAL_HOST` (you get the address after the first deploy; set these and redeploy).
4. `JWT_SECRET` and `FORM_SECRET` are generated for you.
5. When it is live, open `https://YOUR-SITE/api/health`. It should say `"storage":"mongodb"`.

## 3. First administrator
Students register themselves. The admin account is created on the server, never through the website:
```
cd server
set MONGODB_URI=mongodb+srv://...
node scripts/create-admin.js
```
(follow the prompts / see the script header). Then log in at `/login` and open **Admin**.

## 4. Things to know
- **Free Render sleeps** after ~15 minutes without visits. The first visit takes ~30 s to wake it, and **email reminders cannot go out while it sleeps**. For dependable reminders use a paid always-on instance, or ping `/api/health` every 10 minutes with a free uptime monitor.
- **Reminder emails** need `RESEND_API_KEY` and `MAIL_FROM` (a domain you verified with Resend). Without them the app says plainly that email was not sent.
- **Old database?** The subjects collection now has a different unique index (it includes the owner). On a database created with an older version, drop the `subjects` collection's indexes once (Atlas, Collections, Indexes) and restart.
- Keep `NODE_ENV=production` only on the host, never in your laptop `.env`.
