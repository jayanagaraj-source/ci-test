import { AppError, NotFoundError } from '../lib/errors.js';

export const notFound = (req) => {
  throw new NotFoundError(`Route ${req.method} ${req.path} not found`);
};

/** Translates body-parser failures into domain errors. */
function normalize(err) {
  if (err instanceof AppError) return err;
  if (err?.type === 'entity.parse.failed') {
    return new AppError('Malformed JSON body', { status: 400, code: 'BAD_JSON' });
  }
  if (err?.type === 'entity.too.large') {
    return new AppError('Request body too large', { status: 413, code: 'PAYLOAD_TOO_LARGE' });
  }
  return null;
}

export const errorHandler = (logger) => (err, req, res, _next) => {
  const appError = normalize(err);
  const status = appError?.status ?? 500;

  if (status >= 500) {
    (req.log ?? logger).error({ err }, 'Unhandled error');
  }

  if (res.headersSent) {
    res.end();
    return;
  }

  res.status(status).json({
    error: {
      code: appError?.code ?? 'INTERNAL_ERROR',
      // Never leak internal error messages to clients.
      message: appError?.message ?? 'Internal server error',
      ...(appError?.details && { details: appError.details }),
      requestId: req.id,
    },
  });
};
