import { Router } from 'express';

export function createHealthRouter() {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/ready', (_req, res) => {
    const { rss, heapUsed } = process.memoryUsage();
    res.json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      memory: { rss, heapUsed },
    });
  });

  return router;
}
