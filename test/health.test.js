import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';
import { loadConfig } from '../src/config/index.js';

describe('health and platform behaviour', () => {
  let api;
  before(async () => {
    api = await startTestServer();
  });
  after(() => api.close());

  it('reports liveness and readiness', async () => {
    const live = await api.request('GET', '/health/live');
    const ready = await api.request('GET', '/health/ready');
    assert.equal(live.status, 200);
    assert.equal(ready.status, 200);
    assert.equal(typeof ready.body.uptimeSeconds, 'number');
  });

  it('sets security headers and echoes a safe request id', async () => {
    const res = await api.request('GET', '/health/live', { headers: { 'x-request-id': 'trace-123' } });
    assert.equal(res.headers.get('x-request-id'), 'trace-123');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  it('replaces unsafe request ids', async () => {
    const res = await api.request('GET', '/health/live', { headers: { 'x-request-id': 'bad id <script>' } });
    assert.match(res.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
  });

  it('returns a structured 404 for unknown routes', async () => {
    const res = await api.request('GET', '/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
    assert.ok(res.body.error.requestId);
  });
});

describe('config', () => {
  it('fails fast on a weak JWT secret', () => {
    assert.throws(() => loadConfig({ JWT_SECRET: 'short' }), /JWT_SECRET/);
  });

  it('parses comma-separated CORS origins', () => {
    const config = loadConfig({
      JWT_SECRET: 'x'.repeat(32),
      CORS_ORIGIN: 'https://a.example, https://b.example',
    });
    assert.deepEqual(config.corsOrigins, ['https://a.example', 'https://b.example']);
  });
});
