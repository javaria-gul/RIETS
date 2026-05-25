# RIETS Vercel Deployment Guide

## 1) Final architecture

- **Frontend:** Vercel
- **Backend API:** Vercel Serverless Functions
- **Database:** Neon PostgreSQL

This project is designed to run fully on Vercel with Neon as the only database.

## 2) Important: local `.env` is not deployed

Vercel does **not** read your local `.env` file from the laptop.

You must add environment variables inside the **Vercel Dashboard** for the project.

## 3) Required Vercel environment variables

Go to:

**Vercel Dashboard → Your Project → Settings → Environment Variables**

Add:

```env
DATABASE_URL=your_neon_postgres_connection_string
```

Recommended scope:

- **Production**
- **Preview**
- **Development**

Notes:

- `DATABASE_URL` is the only required variable for the deployed app.
- `PORT` is not needed on Vercel.
- `NODE_ENV` is handled by Vercel automatically.

## 4) Deploy flow

1. Push the latest code to GitHub
2. Import the repo into Vercel
3. Add `DATABASE_URL` in Vercel environment variables
4. Redeploy
5. Verify `/api/telemetry/summary` returns data

## 5) If the build still shows old errors

If Vercel still reports the previous TypeScript error, it usually means one of these:

- the latest fix was not pushed to GitHub
- Vercel is building an older commit
- the project needs a fresh redeploy after env changes

## 6) What the app needs from Neon

Make sure your Neon database has:

- `products`
- `sales_transactions`
- `inventory_snapshots`
- `anomaly_logs`

If the database is empty, the app will try to bootstrap demo data.

## 7) Quick verification checklist

- [ ] `DATABASE_URL` added in Vercel dashboard
- [ ] Latest commit pushed to GitHub
- [ ] Vercel deployment triggered again
- [ ] API routes respond without errors
- [ ] KPI cards show non-zero values

## 8) Browser debug check

After redeploy, open:

```text
https://riets.vercel.app/api/debug
```

Expected response:

```json
{
	"runtime": "vercel-serverless",
	"hasDatabaseUrl": true,
	"dbStatus": "connected",
	"neonUrlMatch": true
}
```

If `hasDatabaseUrl` is `false`, your Vercel environment variable is not set correctly.

If `dbStatus` is `simulation`, the app is still falling back instead of connecting to Neon.
