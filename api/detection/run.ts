import { sendJson } from '../_utils';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  try {
    const { logger } = await import('../../src/utils/logger');
    const { runDetectionAudit } = await import('../../src/services/detection');
    
    logger.info('API Triggered: Exception Audit Sweeper');
    const auditResult = await runDetectionAudit();
    logger.info({ auditResult }, 'Exception Audit completed successfully');
    
    return sendJson(res, 200, auditResult);
  } catch (error: any) {
    return sendJson(res, 500, { error: error.message });
  }
}
