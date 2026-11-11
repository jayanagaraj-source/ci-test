import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

/** Reads SSE frames from a fetch response until `predicate` matches one. */
async function waitForEvent(reader, predicate, timeoutMs = 2000) {
  const decoder = new TextDecoder();
  let buffer = '';
  const deadline = AbortSignal.timeout(timeoutMs);

  while (!deadline.aborted) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = /^event: (.+)$/m.exec(frame)?.[1];
      const data = /^data: (.+)$/m.exec(frame)?.[1];
      if (event && predicate(event, JSON.parse(data))) return { event, data: JSON.parse(data) };
    }
  }
  throw new Error('Timed out waiting for SSE event');
}

describe('task event stream', () => {
  let api;
  before(async () => {
    api = await startTestServer();
  });
  after(() => api.close());

  it('streams only the caller’s own task events', async () => {
    await api.register('admin@example.com', 'Admin');
    const alice = await api.register('alice@example.com', 'Alice');
    const bob = await api.register('bob@example.com', 'Bob');

    const controller = new AbortController();
    const res = await fetch(`${api.baseUrl}/api/v1/tasks/events`, {
      headers: { authorization: `Bearer ${alice.token}` },
      signal: controller.signal,
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const reader = res.body.getReader();

    // Bob's task must not reach Alice; her own task must.
    await api.request('POST', '/api/v1/tasks', { token: bob.token, body: { title: 'bob secret' } });
    await api.request('POST', '/api/v1/tasks', { token: alice.token, body: { title: 'alice task' } });

    const received = await waitForEvent(reader, (event) => event === 'task.created');
    assert.equal(received.data.title, 'alice task');

    controller.abort();
  });
});
