import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import { createLogger } from '../src/lib/logger.js';

export const STRONG_PASSWORD = 'Sup3rSecretPass';

/** Boots an isolated app instance on a random port. */
export async function startTestServer() {
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    BCRYPT_ROUNDS: '4',
    RATE_LIMIT_MAX: '10000',
    AUTH_RATE_LIMIT_MAX: '10000',
  });
  const app = createApp({ config, logger: createLogger(config) });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function request(method, path, { body, token, headers = {} } = {}) {
    const res = await fetch(baseUrl + path, {
      method,
      headers: {
        ...(body !== undefined && { 'content-type': 'application/json' }),
        ...(token && { authorization: `Bearer ${token}` }),
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  }

  async function register(email, name = 'Test User') {
    const res = await request('POST', '/api/v1/auth/register', {
      body: { email, name, password: STRONG_PASSWORD },
    });
    if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
    return res.body.data;
  }

  return {
    baseUrl,
    request,
    register,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
