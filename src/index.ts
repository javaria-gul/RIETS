import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { router as apiRouter } from './api/routes.ts';
import { logger } from './utils/logger.ts';
import { isSimulated } from './db/index.ts';
import { runSimulationAudit } from './db/simulation.ts';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Pino logger HTTP request interceptor
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration
    }, `HTTP ${req.method} ${req.originalUrl}`);
  });
  next();
});

// API Routes
app.use('/api', apiRouter);

// Base health indicator
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// SPA routing in production mode
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback all non-API queries to React client HTML in production
app.get('*', (req, res) => {
  // If it does not begin with /api, serve the Vite single-page build index
  if (!req.originalUrl.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) {
        // If dist/index.html does not exist yet (Vite not compiled yet), return basic placeholder
        res.status(200).send(`
          <div style="font-family: sans-serif; padding: 2rem; background: #080c16; color: #fff; height: 100vh;">
            <h2>RIETS Backend Operating Successfully</h2>
            <p>Static frontend build is missing or has not been compiled yet. Run <code>npm run build</code> or query <code>npm run dev</code> for hot-reloads.</p>
          </div>
        `);
      }
    });
  } else {
    res.status(404).json({ error: 'API route not found' });
  }
});

// If running in simulation mode, execute one initial audit to populate in-memory anomaly logs
if (isSimulated) {
  try {
    const initial = runSimulationAudit();
    logger.info(`🔍 Initial simulation audit injected ${initial.length} anomaly logs`);
  } catch (err: any) {
    logger.error({ err: err?.message }, 'Failed to run initial simulation audit');
  }

  // Keep simulation metrics alive without manual intervention
  const AUTO_SWEEP_MS = 5 * 60 * 1000;
  setInterval(() => {
    try {
      const next = runSimulationAudit();
      logger.info(`🔁 Auto simulation sweep injected ${next.length} new anomaly logs`);
    } catch (err: any) {
      logger.error({ err: err?.message }, 'Auto simulation sweep failed');
    }
  }, AUTO_SWEEP_MS);
}

app.listen(PORT, () => {
  logger.info(`✨ RIETS Core Serverless-Optimized Backend listening on port ${PORT}`);
});
