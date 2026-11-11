import { ValidationError } from '../lib/errors.js';

const SOURCES = ['params', 'query', 'body'];

/**
 * Validates request parts against Zod schemas. Parsed (coerced, defaulted)
 * values land on `req.validated` because Express 5 makes `req.query` read-only.
 */
export const validate = (schemas) => (req, _res, next) => {
  req.validated ??= {};
  const details = [];

  for (const source of SOURCES) {
    const schema = schemas[source];
    if (!schema) continue;

    const result = schema.safeParse(req[source] ?? {});
    if (result.success) {
      req.validated[source] = result.data;
    } else {
      for (const issue of result.error.issues) {
        details.push({ path: [source, ...issue.path].join('.'), message: issue.message });
      }
    }
  }

  if (details.length > 0) throw new ValidationError('Invalid request', details);
  next();
};
