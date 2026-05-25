import { sendJson, isSimulated } from '../_utils';

export default function handler(req: any, res: any) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const now = new Date();
    const baseCpu = 25 + Math.sin(Date.now() / 20000) * 12;
    const cpuRandom = Math.random() * 4;
    const cpuUsage = Math.min(100, Math.max(0, baseCpu + cpuRandom)).toFixed(1);
    const baseMemory = 1120 + Math.sin(Date.now() / 40000) * 80;
    const memoryRandom = Math.random() * 15;
    const memoryUsed = (baseMemory + memoryRandom).toFixed(0);
    const activeConnections = isSimulated ? 0 : 1;

    return sendJson(res, 200, {
      cpu: parseFloat(cpuUsage),
      memory: { usedMB: parseInt(memoryUsed), totalMB: 4096, percentage: parseFloat(((parseInt(memoryUsed) / 4096) * 100).toFixed(1)) },
      dbConnections: activeConnections,
      dbStatus: isSimulated ? 'Simulation' : 'Operational',
      neonPoolStatus: isSimulated ? 'Offline Fallback' : 'Stable',
      timestamp: now.toISOString()
    });
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message });
  }
}
