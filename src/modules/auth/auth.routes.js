import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

export function createAuthRouter({ authService, requireAuth, authLimiter }) {
  const router = Router();

  router.post('/register', authLimiter, validate({ body: registerSchema }), async (req, res) => {
    const result = await authService.register(req.validated.body);
    res.status(201).json({ data: result });
  });

  router.post('/login', authLimiter, validate({ body: loginSchema }), async (req, res) => {
    const result = await authService.login(req.validated.body);
    res.json({ data: result });
  });

  router.get('/me', requireAuth, async (req, res) => {
    res.json({ data: await authService.profile(req.user.id) });
  });

  return router;
}
