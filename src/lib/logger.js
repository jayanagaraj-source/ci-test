import pino from 'pino';

export function createLogger(config) {
  return pino({
    level: config.LOG_LEVEL,
    base: { service: 'taskflow-api', env: config.NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.passwordHash',
        '*.token',
      ],
      censor: '[REDACTED]',
    },
  });
}
