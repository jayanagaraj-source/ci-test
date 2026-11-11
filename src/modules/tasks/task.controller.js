import { PreconditionFailedError } from '../../lib/errors.js';
import { TASK_EVENT, canAccess } from './task.service.js';

const HEARTBEAT_MS = 25_000;

const etagOf = (task) => `"${task.version}"`;

/** Parses an `If-Match: "<version>"` header; undefined when absent. */
function parseIfMatch(header) {
  if (header === undefined) return undefined;
  const match = /^"(\d+)"$/.exec(header.trim());
  if (!match) throw new PreconditionFailedError('If-Match must be a quoted task version, e.g. "3"');
  return Number(match[1]);
}

export function createTaskController({ taskService, events }) {
  return {
    async list(req, res) {
      res.json(await taskService.list(req.user, req.validated.query));
    },

    async get(req, res) {
      const task = await taskService.get(req.user, req.validated.params.id);
      res.set('ETag', etagOf(task)).json({ data: task });
    },

    async create(req, res) {
      const task = await taskService.create(req.user, req.validated.body);
      res
        .status(201)
        .location(`${req.baseUrl}/${task.id}`)
        .set('ETag', etagOf(task))
        .json({ data: task });
    },

    async update(req, res) {
      const expectedVersion = parseIfMatch(req.get('if-match'));
      const task = await taskService.update(
        req.user,
        req.validated.params.id,
        req.validated.body,
        expectedVersion,
      );
      res.set('ETag', etagOf(task)).json({ data: task });
    },

    async remove(req, res) {
      await taskService.remove(req.user, req.validated.params.id);
      res.status(204).end();
    },

    /** Server-Sent Events stream of task changes visible to the caller. */
    stream(req, res) {
      res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders();
      res.write(': connected\n\n');

      const onEvent = ({ type, task }) => {
        if (!canAccess(req.user, task)) return;
        res.write(`event: ${type}\nid: ${task.id}:${task.version}\ndata: ${JSON.stringify(task)}\n\n`);
      };

      const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
      heartbeat.unref();
      events.on(TASK_EVENT, onEvent);

      req.on('close', () => {
        clearInterval(heartbeat);
        events.off(TASK_EVENT, onEvent);
      });
    },
  };
}
