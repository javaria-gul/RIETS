# RIETS

![RIETS Banner](https://img.shields.io/badge/RIETS-Retail%20Intelligence%20%26%20Exception%20Tracking%20System-0ea5e9?style=for-the-badge)

**RIETS** is an enterprise-grade retail intelligence platform for exception tracking, anomaly detection, catalog operations, telemetry monitoring, and business visibility.

## Tech Stack

![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Neon](https://img.shields.io/badge/Neon-00E599?style=flat-square&logo=postgresql&logoColor=white)
![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-111827?style=flat-square&logo=databricks&logoColor=white)
![React Query](https://img.shields.io/badge/React_Query-FF4154?style=flat-square&logo=reactquery&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-8884d8?style=flat-square&logo=chartdotjs&logoColor=white)

## What RIETS does

- **Live telemetry dashboard** for CPU, memory, and pool status
- **Executive KPI cards** for active exceptions, critical threats, return-risk SKUs, and stalled capital
- **Exception feed** with filtering, pagination, and resolution workflow
- **Product catalog management** for add, edit, retire, and search operations
- **Category sales vs returns analytics** for business visibility
- **Automated anomaly detection** across inventory and transaction behavior
- **Simulation mode support** for demo data and local development

## Business Use Cases

RIETS is designed for:

- retail operations teams
- analysts and exception managers
- catalog / SKU governance
- revenue protection
- inventory health monitoring
- executive operations dashboards

## Core Platform Features

### 1. Executive Dashboard

- Active Exceptions
- Critical Threat Level
- Return Ratio Excess
- Total Stalled Capital

### 2. Exception Core Auditing

- unresolved anomaly feed
- severity-based filtering
- real-time resolution workflow
- anomaly search and pagination

### 3. Catalog Registry Management

- create new product SKUs
- update product metadata
- retire product entries
- search by SKU / name
- filter by category

### 4. Telemetry & Analytics

- CPU and memory trend tracking
- database connection visibility
- category-wise sales vs returns charts

### 5. Automated Detection Engines

- zero sales with stock
- significant sales drop
- negative inventory balance
- inactive product sales
- excessive return ratio

## Screens in the App

- top executive KPI cards
- real-time telemetry charts
- anomaly feed / exception audit table
- product catalog management panel
- toast notifications for operational actions

## Project Structure

- `src/App.tsx` — app shell and top-level dashboard
- `src/components/TelemetryCharts.tsx` — telemetry and category charts
- `src/components/AnomalyFeed.tsx` — anomaly feed and resolution workflow
- `src/components/ProductManager.tsx` — product catalog management
- `src/api/routes.ts` — API routes for telemetry, products, and anomalies
- `src/services/detection.ts` — anomaly detection logic
- `src/db/` — database, schema, seed, reset, and simulation data

## Local Development

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/riets.git
cd riets
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set environment variables

Create a `.env` file:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME
PORT=5000
```

### 4. Push schema to database

```bash
npm run db:push
```

### 5. Seed demo / business data

```bash
npm run db:seed
```

### 6. Run the app

```bash
npm run dev
```

## Deployment Notes

This repository is ready for a **Vercel-only deployment**.

- **Frontend:** Vercel
- **Backend API:** Vercel Serverless Functions
- **Database:** Neon PostgreSQL

For detailed deployment instructions, see [VERCEL_DEPLOYMENT_GUIDE.md](VERCEL_DEPLOYMENT_GUIDE.md).

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string
- `PORT` — backend port, default `5000`

## Scripts

- `npm run dev` — run frontend and backend together
- `npm run dev:backend` — run Express backend
- `npm run dev:frontend` — run Vite frontend
- `npm run build` — build for production
- `npm run db:push` — apply schema to database
- `npm run db:seed` — seed the database
- `npm run db:reset` — reset the database

## Recommended Production Flow

1. Push code to GitHub
2. Configure Neon PostgreSQL
3. Add `DATABASE_URL` in Vercel project settings
4. Deploy the project to Vercel
5. Confirm the KPI cards and anomaly feed are populated

## Troubleshooting

- If KPI cards show `0`, verify data seeding and `DATABASE_URL`
- If proxy errors appear, confirm the backend is running on port `5000`
- If APIs return `500`, check database connectivity and schema state

## License

Internal / custom business application template.
