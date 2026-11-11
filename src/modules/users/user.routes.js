import { Router } from 'express';
import { authorize } from '../../middleware/auth.js';
import { toPublicUser } from './user.repository.js';

export function createUserRouter({ users }) {
  const router = Router();

  router.get('/', authorize('admin'), async (_req, res) => {
    const all = await users.list();
    res.json({ data: all.map(toPublicUser) });
  });

  return router;
}
