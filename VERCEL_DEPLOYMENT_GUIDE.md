# RIETS Deployment Guide

## 1) What this project is

RIETS is a retail intelligence dashboard built with:

- **Frontend:** Vite + React + TypeScript
- **Backend:** Express + TypeScript
- **Database:** PostgreSQL / Neon
- **UI:** Tailwind CSS + Lucide icons + Recharts

## 2) Important deployment note

This repository contains an **Express backend** in `src/index.ts`.

Vercel is excellent for the React frontend, but it does **not** run a long-lived Express server the same way a Node host does.

### Recommended production setup

- **Frontend:** Vercel
- **Database:** Neon PostgreSQL
- **Backend API:** Render, Railway, Fly.io, or another Node host

If you want a **single-host Vercel-only** deployment, the backend must be converted into Vercel serverless functions first.

---

## 3) Clone the project

```bash
git clone https://github.com/<your-username>/riets.git
cd riets
```

## 4) Install dependencies

```bash
npm install
```

## 5) Create your database

Use **Neon**, **Supabase**, **Railway Postgres**, or your own PostgreSQL instance.

Set your connection string:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME
```

## 6) Push the schema

```bash
npm run db:push
```

## 7) Seed business data

```bash
npm run db:seed
```

This seeds:

- products
- sales transactions
- inventory snapshots
- anomaly logs

## 8) Run locally

```bash
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

---

## 9) Deploy backend API

Deploy the Express app to a Node host such as:

- Render
- Railway
- Fly.io
- DigitalOcean App Platform

### Backend environment variable

```env
DATABASE_URL=your_postgres_connection_string
PORT=5000
```

Make sure the backend URL is publicly reachable.

---

## 10) Deploy frontend on Vercel

In Vercel:

1. Import the GitHub repository
2. Set the framework preset to **Vite**
3. Add the frontend build command:

```bash
npm run build
```

4. Set the output directory:

```bash
dist
```

5. Add environment variables if your frontend is configured to use a remote API host

### If backend is hosted separately

Update the frontend API calls to point to the deployed API URL instead of `/api/...` on localhost.

Example:

```text
https://your-api-host.com/api/telemetry/summary
```

---

## 11) Business deployment checklist

Before going live:

- [ ] Database is seeded with real business data
- [ ] API endpoints return non-zero telemetry
- [ ] Product catalog is mapped to your SKUs
- [ ] Sales transactions are connected
- [ ] Inventory snapshots are updating
- [ ] Anomaly detection audit is working
- [ ] Vercel frontend can reach the deployed backend

---

## 12) Troubleshooting

### KPI cards show zero

- Database may be empty
- `DATABASE_URL` may point to the wrong database
- Detection audit may not have been run yet

### `ECONNREFUSED` in Vite proxy

- Backend is not running on `localhost:5000`
- Or backend started after the frontend

### Summary API returns 500

- Check PostgreSQL connectivity
- Check that tables exist
- Run `npm run db:push` again if needed

---

## 13) Final production flow

1. Push code to GitHub
2. Deploy backend to a Node host
3. Attach PostgreSQL database
4. Deploy frontend to Vercel
5. Confirm analytics cards are populated
