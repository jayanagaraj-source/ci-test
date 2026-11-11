import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STRONG_PASSWORD, startTestServer } from './helpers.js';

describe('auth', () => {
  let api;
  before(async () => {
    api = await startTestServer();
  });
  after(() => api.close());

  it('makes the first registered user an admin and later users regular users', async () => {
    const first = await api.register('Admin@Example.com');
    const second = await api.register('user@example.com');

    assert.equal(first.user.role, 'admin');
    assert.equal(first.user.email, 'admin@example.com');
    assert.equal(second.user.role, 'user');
    assert.ok(first.token);
    assert.equal(first.user.passwordHash, undefined);
  });

  it('rejects duplicate emails', async () => {
    const res = await api.request('POST', '/api/v1/auth/register', {
      body: { email: 'user@example.com', name: 'Dup', password: STRONG_PASSWORD },
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CONFLICT');
  });

  it('enforces password strength', async () => {
    const res = await api.request('POST', '/api/v1/auth/register', {
      body: { email: 'weak@example.com', name: 'Weak', password: 'short' },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.some((d) => d.path === 'body.password'));
  });

  it('logs in with valid credentials and rejects invalid ones', async () => {
    const ok = await api.request('POST', '/api/v1/auth/login', {
      body: { email: 'user@example.com', password: STRONG_PASSWORD },
    });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.data.token);

    const wrongPassword = await api.request('POST', '/api/v1/auth/login', {
      body: { email: 'user@example.com', password: 'nope' },
    });
    const unknownUser = await api.request('POST', '/api/v1/auth/login', {
      body: { email: 'ghost@example.com', password: STRONG_PASSWORD },
    });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownUser.status, 401);
    assert.equal(wrongPassword.body.error.message, unknownUser.body.error.message);
  });

  it('protects /me with a bearer token', async () => {
    const anonymous = await api.request('GET', '/api/v1/auth/me');
    assert.equal(anonymous.status, 401);

    const forged = await api.request('GET', '/api/v1/auth/me', { token: 'not.a.jwt' });
    assert.equal(forged.status, 401);

    const { token } = await api.register('me@example.com', 'Me');
    const me = await api.request('GET', '/api/v1/auth/me', { token });
    assert.equal(me.status, 200);
    assert.equal(me.body.data.email, 'me@example.com');
  });

  it('restricts the user directory to admins', async () => {
    const admin = (
      await api.request('POST', '/api/v1/auth/login', {
        body: { email: 'admin@example.com', password: STRONG_PASSWORD },
      })
    ).body.data;
    const user = (
      await api.request('POST', '/api/v1/auth/login', {
        body: { email: 'user@example.com', password: STRONG_PASSWORD },
      })
    ).body.data;

    assert.equal((await api.request('GET', '/api/v1/users', { token: user.token })).status, 403);

    const list = await api.request('GET', '/api/v1/users', { token: admin.token });
    assert.equal(list.status, 200);
    assert.ok(list.body.data.length >= 2);
    assert.ok(list.body.data.every((u) => u.passwordHash === undefined));
  });
});
