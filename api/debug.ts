import { sendJson, isSimulated } from './_utils';

export default function handler(req: any, res: any) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    return sendJson(res, 200, {
      runtime: 'vercel-serverless',
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      dbStatus: isSimulated ? 'simulation' : 'connected',
      neonUrlMatch: Boolean(process.env.DATABASE_URL?.includes('neon.tech')),
    });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message });
  }
}
