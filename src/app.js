import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';

import { createTokenService } from './lib/tokens.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { createHealthRouter } from './routes/health.js';
import { InMemoryUserRepository } from './modules/users/user.repository.js';
import { createUserRouter } from './modules/users/user.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { InMemoryTaskRepository } from './modules/tasks/task.repository.js';
import { createTaskService } from './modules/tasks/task.service.js';
import { createTaskRouter } from './modules/tasks/task.routes.js';

const REQUEST_ID_PATTERN = /^[\w-]{1,64}$/;

/**
 * Builds the Express application. All collaborators are wired here (a small
 * composition root), so tests can create isolated instances freely.
 */
export function createApp({ config, logger }) {
  // --- dependencies -------------------------------------------------------
  const users = new InMemoryUserRepository();
  const tasks = new InMemoryTaskRepository();
  const events = new EventEmitter().setMaxListeners(1000);
  const tokens = createTokenService({ secret: config.JWT_SECRET, expiresIn: config.JWT_EXPIRES_IN });
  const authService = createAuthService({ users, tokens, bcryptRounds: config.BCRYPT_ROUNDS });
  const taskService = createTaskService({ tasks, events });
  const requireAuth = authenticate(tokens);

  const limiterOptions = { standardHeaders: 'draft-7', legacyHeaders: false };
  const apiLimiter = rateLimit({
    ...limiterOptions,
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX,
  });
  const authLimiter = rateLimit({
    ...limiterOptions,
    windowMs: 15 * 60_000,
    limit: config.AUTH_RATE_LIMIT_MAX,
    skipSuccessfulRequests: true,
  });

  // --- app ----------------------------------------------------------------
  const app = express();
  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger,
      genReqId(req, res) {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url.startsWith('/health') },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, exposedHeaders: ['ETag', 'Location', 'X-Request-Id'] }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', createHealthRouter());

  const api = express.Router();
  api.use(apiLimiter);
  api.use('/auth', createAuthRouter({ authService, requireAuth, authLimiter }));
  api.use('/users', requireAuth, createUserRouter({ users }));
  api.use('/tasks', requireAuth, createTaskRouter({ taskService, events }));
  app.use('/api/v1', api);

  app.use(notFound);
  app.use(errorHandler(logger));

  return app;
}
