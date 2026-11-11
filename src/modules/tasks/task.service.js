import { NotFoundError } from '../../lib/errors.js';

export const TASK_EVENT = 'task';

export const canAccess = (user, task) => user.role === 'admin' || task.ownerId === user.id;

export function createTaskService({ tasks, events }) {
  const publish = (type, task) => events.emit(TASK_EVENT, { type, task });

  // Tasks owned by someone else are reported as missing (not forbidden) so
  // their existence is not disclosed.
  async function load(user, id) {
    const task = await tasks.findById(id);
    if (!task || !canAccess(user, task)) throw new NotFoundError('Task not found');
    return task;
  }

  return {
    async create(user, input) {
      const task = await tasks.create({ ...input, ownerId: user.id });
      publish('task.created', task);
      return task;
    },

    get: load,

    async list(user, query) {
      const ownerId = user.role === 'admin' ? undefined : user.id;
      const { items, total } = await tasks.list({ ...query, ownerId });
      return {
        data: items,
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    },

    async update(user, id, patch, expectedVersion) {
      await load(user, id);
      const task = await tasks.update(id, patch, expectedVersion);
      if (!task) throw new NotFoundError('Task not found');
      publish('task.updated', task);
      return task;
    },

    async remove(user, id) {
      const task = await load(user, id);
      await tasks.delete(id);
      publish('task.deleted', task);
    },
  };
}
