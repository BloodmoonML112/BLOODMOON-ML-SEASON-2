# Blood Moon ML Season 2 Website

Responsive dark red/black tournament website with:
- Team registration form
- Exactly 5 required main players and up to 2 optional substitutes
- BO3 / BO5 rules displayed
- Admin login and dashboard
- Approve / reject / mark pending registrations
- CSV export
- Supabase PostgreSQL database (registrations persist across app redeploys)
- Input validation, signed admin sessions, login rate limiting, Helmet security headers

## Free online setup (phone or computer)

You need a GitHub account, a Supabase account, and a Render account. Free-plan limits can change; free services may sleep and Supabase free projects may pause after a week of low activity. See the official docs linked below.

### Step 1 — Create the database in Supabase
1. Open https://supabase.com and create a free project.
2. Save the database password somewhere private.
3. In the Supabase project, open **Project Settings → Database** and find the connection string/URI. Copy the PostgreSQL connection string. If available, use the connection pooler URI for apps hosted outside Supabase.
4. Replace the `[YOUR-PASSWORD]` placeholder with your database password. Do not post the connection string publicly.

The app automatically creates its `registrations` table on first startup.

### Step 2 — Upload this project to GitHub
1. Download the ZIP and extract it.
2. Open https://github.com, create a new repository such as `blood-moon-season-2`, and keep it private if you prefer.
3. Upload the contents of this folder to the repository root (not the ZIP itself).
4. Confirm `package.json`, `server.js`, and the `public` folder appear at the repository root.

### Step 3 — Deploy on Render
1. Open https://render.com and sign up/log in.
2. Choose **New → Web Service** and connect your GitHub repository.
3. Set:
   - Name: `blood-moon-ml-season-2` (or an available name)
   - Runtime/Language: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free (if offered to your account)
4. In Environment Variables, add:
   - `ADMIN_USER` = a username you choose
   - `ADMIN_PASSWORD` = a unique strong password of at least 12 characters
   - `SESSION_SECRET` = a random secret of at least 32 characters
   - `DATABASE_URL` = the Supabase PostgreSQL connection string
5. Click **Create Web Service** and wait for the deploy to finish.
6. Open the `onrender.com` URL shown on the Render service page.

For `SESSION_SECRET`, use a long random string (at least 32 characters). Never share the password or secrets with anyone. Do not put secrets in the GitHub repository.

### Step 4 — Test
1. Open the public website and submit a test registration.
2. Click **Admin** on the website and sign in using your configured admin credentials.
3. Check the test team, change status to Approved, and test CSV export.
4. Delete the test registration after checking.

## Official hosting documentation
- Render first deploy: https://render.com/docs/your-first-deploy
- Render free services: https://render.com/docs/free
- Supabase free project pausing: https://supabase.com/docs/guides/platform/free-project-pausing

## Important
- Free Render web services may sleep after 15 minutes of inactivity; the first visit afterward can be slow.
- Supabase free projects may pause after a week of low activity. Monitor the project and follow Supabase's current rules.
- Free plans are intended for hobby/testing use and may have limits; check current plan terms before your tournament launch.
- This starter stores team/player information, so share the site only with people who need it and secure your admin credentials.
- This starter does not yet implement payments, email/SMS notifications, logo file uploads, automatic brackets, live standings, or a public team directory.
