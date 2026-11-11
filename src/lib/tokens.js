import jwt from 'jsonwebtoken';
import { UnauthorizedError } from './errors.js';

const ALGORITHM = 'HS256';
const ISSUER = 'taskflow-api';

export function createTokenService({ secret, expiresIn }) {
  return {
    sign(user) {
      return jwt.sign({ role: user.role, email: user.email }, secret, {
        subject: user.id,
        expiresIn,
        issuer: ISSUER,
        algorithm: ALGORITHM,
      });
    },

    verify(token) {
      try {
        const payload = jwt.verify(token, secret, {
          algorithms: [ALGORITHM],
          issuer: ISSUER,
        });
        return { id: payload.sub, role: payload.role, email: payload.email };
      } catch {
        throw new UnauthorizedError('Invalid or expired token');
      }
    },
  };
}
