import { sendJson, isSimulated } from './_utils';
import { dbDriver } from '../src/db/index';

export default function handler(req: any, res: any) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    return sendJson(res, 200, {
      runtime: process.env.VERCEL ? 'vercel-serverless' : 'local',
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      dbStatus: isSimulated ? 'simulation' : 'connected',
      dbDriver,
      vercelRuntime: Boolean(process.env.VERCEL),
      neonUrlMatch: Boolean(process.env.DATABASE_URL?.includes('neon.tech')),
    });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message });
  }
}
