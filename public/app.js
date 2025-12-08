# Deploying Oneflow Life on Render (quick guide)

This repository contains a Node/Express server (server.js) that serves a static frontend (public/) and exposes API endpoints.
The server supports both:
- A managed Postgres database (recommended) via env var `DATABASE_URL` (Render provides this).
- An in-memory fallback DB if `DATABASE_URL` is not provided (not persistent, only for quick dev testing).

Goal: You will push these files to GitHub and create a Render Web Service that uses the repository. Render will run `npm start` and your service will connect to the Postgres DB.

Steps to deploy on Render
1. Push this repo (or these files) to GitHub (e.g., mosheco2/family-flow).
2. In Render dashboard:
   - Click "New" → "Web Service".
   - Connect your GitHub repo and choose the branch.
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance: choose plan (free works for demo)
3. Create a Postgres database:
   - In Render dashboard click "New" → "Database" → "PostgreSQL".
   - Name it (e.g., `oneflow-life-db`), choose region/plan.
   - Once created, copy the `DATABASE_URL` connection string.
4. Add environment variable to your Web Service:
   - Go to Service → Environment → Environment Variables.
   - Add `DATABASE_URL` with the value from the previous step.
5. Deploy:
   - Trigger a deploy (or let Render build automatically when you push).
   - On first run the server will create the schema and seed demo data (users, groups, bundles, and ~920 product rows).
6. Visit the service URL (Render will provide a domain).
   - The front-end is served from `/` and API endpoints under `/api`.

Notes & next steps
- For production you should:
  - Add authentication (JWT / sessions).
  - Add migrations instead of ad-hoc creation (e.g., use a migration framework).
  - Harden SQL inputs, rate limits and implement roles/authorization endpoints.
  - Move seed logic to a migration/seed script if desired.
- If you prefer infrastructure-as-code, you can also create a `render.yaml` to declare service+database.

If you want, I can:
- Open a PR in your GitHub repo with these files.
- Or just give you the exact file set to paste — up to you.
