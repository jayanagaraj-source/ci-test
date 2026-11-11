import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

describe('tasks', () => {
  let api;
  let admin;
  let alice;
  let bob;

  before(async () => {
    api = await startTestServer();
    admin = await api.register('admin@example.com', 'Admin');
    alice = await api.register('alice@example.com', 'Alice');
    bob = await api.register('bob@example.com', 'Bob');
  });
  after(() => api.close());

  const createTask = (token, body) => api.request('POST', '/api/v1/tasks', { token, body });

  it('requires authentication', async () => {
    assert.equal((await api.request('GET', '/api/v1/tasks')).status, 401);
  });

  it('creates a task with defaults, a Location header and an ETag', async () => {
    const res = await createTask(alice.token, { title: '  Write docs  ' });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.title, 'Write docs');
    assert.equal(res.body.data.status, 'todo');
    assert.equal(res.body.data.priority, 'medium');
    assert.deepEqual(res.body.data.tags, []);
    assert.equal(res.body.data.ownerId, alice.user.id);
    assert.equal(res.headers.get('etag'), '"1"');
    assert.equal(res.headers.get('location'), `/api/v1/tasks/${res.body.data.id}`);
  });

  it('rejects invalid and unknown fields', async () => {
    const res = await createTask(alice.token, { title: '', priority: 'urgent', hacker: true });
    assert.equal(res.status, 400);
    const paths = res.body.error.details.map((d) => d.path);
    assert.ok(paths.includes('body.title'));
    assert.ok(paths.includes('body.priority'));
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await api.request('POST', '/api/v1/tasks', { token: alice.token, body: '{"title":' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'BAD_JSON');
  });

  it('isolates tasks between users but lets admins see everything', async () => {
    const { body } = await createTask(bob.token, { title: 'Bob private task' });
    const bobTaskId = body.data.id;

    const asAlice = await api.request('GET', `/api/v1/tasks/${bobTaskId}`, { token: alice.token });
    assert.equal(asAlice.status, 404);

    const deleteAsAlice = await api.request('DELETE', `/api/v1/tasks/${bobTaskId}`, { token: alice.token });
    assert.equal(deleteAsAlice.status, 404);

    const asAdmin = await api.request('GET', `/api/v1/tasks/${bobTaskId}`, { token: admin.token });
    assert.equal(asAdmin.status, 200);

    const aliceList = await api.request('GET', '/api/v1/tasks', { token: alice.token });
    assert.ok(aliceList.body.data.every((t) => t.ownerId === alice.user.id));

    const adminList = await api.request('GET', '/api/v1/tasks', { token: admin.token });
    assert.ok(adminList.body.data.some((t) => t.ownerId === bob.user.id));
  });

  it('applies partial updates without resetting omitted fields', async () => {
    const created = await createTask(alice.token, {
      title: 'Partial',
      priority: 'high',
      tags: ['backend'],
    });
    const id = created.body.data.id;

    const res = await api.request('PATCH', `/api/v1/tasks/${id}`, {
      token: alice.token,
      body: { status: 'in_progress' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'in_progress');
    assert.equal(res.body.data.priority, 'high');
    assert.deepEqual(res.body.data.tags, ['backend']);
    assert.equal(res.body.data.version, 2);
  });

  it('rejects empty patches', async () => {
    const created = await createTask(alice.token, { title: 'Empty patch' });
    const res = await api.request('PATCH', `/api/v1/tasks/${created.body.data.id}`, {
      token: alice.token,
      body: {},
    });
    assert.equal(res.status, 400);
  });

  it('enforces optimistic concurrency through If-Match', async () => {
    const created = await createTask(alice.token, { title: 'Concurrent' });
    const id = created.body.data.id;
    const etag = created.headers.get('etag');

    const first = await api.request('PATCH', `/api/v1/tasks/${id}`, {
      token: alice.token,
      body: { title: 'First writer' },
      headers: { 'if-match': etag },
    });
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('etag'), '"2"');

    const stale = await api.request('PATCH', `/api/v1/tasks/${id}`, {
      token: alice.token,
      body: { title: 'Stale writer' },
      headers: { 'if-match': etag },
    });
    assert.equal(stale.status, 412);
    assert.equal(stale.body.error.code, 'PRECONDITION_FAILED');
  });

  it('filters, searches, sorts and paginates', async () => {
    const carol = await api.register('carol@example.com', 'Carol');
    const titles = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
    for (const [i, title] of titles.entries()) {
      await createTask(carol.token, {
        title,
        priority: i % 2 === 0 ? 'high' : 'low',
        tags: i < 2 ? ['frontend'] : [],
      });
    }

    const page = await api.request('GET', '/api/v1/tasks?sort=title&order=asc&limit=2&page=2', {
      token: carol.token,
    });
    assert.deepEqual(page.body.data.map((t) => t.title), ['charlie', 'delta']);
    assert.deepEqual(page.body.meta, { page: 2, limit: 2, total: 5, totalPages: 3 });

    const high = await api.request('GET', '/api/v1/tasks?priority=high', { token: carol.token });
    assert.equal(high.body.meta.total, 3);

    const tagged = await api.request('GET', '/api/v1/tasks?tag=frontend', { token: carol.token });
    assert.equal(tagged.body.meta.total, 2);

    const search = await api.request('GET', '/api/v1/tasks?q=ECH', { token: carol.token });
    assert.deepEqual(search.body.data.map((t) => t.title), ['echo']);

    const invalid = await api.request('GET', '/api/v1/tasks?limit=1000', { token: carol.token });
    assert.equal(invalid.status, 400);
  });

  it('deletes tasks', async () => {
    const created = await createTask(alice.token, { title: 'Disposable' });
    const id = created.body.data.id;

    assert.equal((await api.request('DELETE', `/api/v1/tasks/${id}`, { token: alice.token })).status, 204);
    assert.equal((await api.request('GET', `/api/v1/tasks/${id}`, { token: alice.token })).status, 404);
  });

  it('rejects non-UUID ids', async () => {
    const res = await api.request('GET', '/api/v1/tasks/123', { token: alice.token });
    assert.equal(res.status, 400);
  });
});
