# Deploying Oneflow Life on Render (quick guide)

This repository contains a Node/Express server (server.js) that serves a static frontend (public/) and exposes API endpoints.
The server supports both:
- A managed Postgres database (recommended) via env var `DATABASE_URL` (Render provides this).
- An in-memory fallback DB if `DATABASE_URL` is not provided (not persistent, only for quick dev testing).

Goal: You will push these files to GitHub and create a Render Web Service that uses the repository. Render will run `npm start` and your service will connect to the Postgres DB.

Steps to deploy on Render
1. Push these files to your GitHub repository (e.g., mosheco2/family-flow).
2. In Render dashboard:
   - Click "New" → "Web Service".
   - Connect your GitHub repo and choose the branch to deploy.
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
3. Create a Postgres database in Render:
   - Click "New" → "Database" → "PostgreSQL".
   - Name it (e.g., `oneflow-life-db`), choose region/plan.
   - Once the database is ready, copy the `DATABASE_URL` connection string.
4. Add environment variable to your Web Service:
   - Go to the Service → Environment → Environment Variables.
   - Add `DATABASE_URL` with the value from the previous step.
5. Deploy:
   - Trigger a deploy (or push to the branch).
   - On first run the server will create the schema and seed demo data (users, groups, bundles, and ~920 product rows).
6. Visit the service URL provided by Render:
   - The front-end is served from `/` and the API is under `/api`.

Notes & recommendations
- Do NOT commit your DATABASE_URL to the repository. Use Render environment variables.
- For production: add authentication (JWT/sessions), use migrations (e.g., node-pg-migrate), and harden inputs.
- If you want me to open a PR with these files into mosheco2/family-flow, tell me and I will create a branch `render/postgres-integration` and a single commit with these files.
