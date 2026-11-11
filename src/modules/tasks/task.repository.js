import { randomUUID } from 'node:crypto';
import { PreconditionFailedError } from '../../lib/errors.js';

const PRIORITY_RANK = { low: 0, medium: 1, high: 2 };

function sortKey(task, field) {
  return field === 'priority' ? PRIORITY_RANK[task.priority] : (task[field] ?? null);
}

function compareBy(field, order) {
  const direction = order === 'asc' ? 1 : -1;
  return (a, b) => {
    const ka = sortKey(a, field);
    const kb = sortKey(b, field);
    if (ka === kb) return 0;
    // Missing values always sort last, regardless of direction.
    if (ka === null) return 1;
    if (kb === null) return -1;
    return (ka < kb ? -1 : 1) * direction;
  };
}

/**
 * In-memory task store with version-based optimistic concurrency control.
 */
export class InMemoryTaskRepository {
  #tasks = new Map();

  async create(data) {
    const now = new Date().toISOString();
    const task = { id: randomUUID(), ...data, version: 1, createdAt: now, updatedAt: now };
    this.#tasks.set(task.id, task);
    return structuredClone(task);
  }

  async findById(id) {
    const task = this.#tasks.get(id);
    return task ? structuredClone(task) : null;
  }

  async update(id, patch, expectedVersion) {
    const current = this.#tasks.get(id);
    if (!current) return null;
    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      throw new PreconditionFailedError(
        `Task was modified concurrently (expected version ${expectedVersion}, current ${current.version})`,
      );
    }
    const next = {
      ...current,
      ...patch,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.#tasks.set(id, next);
    return structuredClone(next);
  }

  async delete(id) {
    return this.#tasks.delete(id);
  }

  async list({ ownerId, status, priority, tag, q, sort, order, page, limit }) {
    const needle = q?.toLowerCase();

    const matches = [...this.#tasks.values()].filter(
      (task) =>
        (ownerId === undefined || task.ownerId === ownerId) &&
        (status === undefined || task.status === status) &&
        (priority === undefined || task.priority === priority) &&
        (tag === undefined || task.tags.includes(tag)) &&
        (needle === undefined ||
          task.title.toLowerCase().includes(needle) ||
          task.description.toLowerCase().includes(needle)),
    );

    matches.sort(compareBy(sort, order));

    const start = (page - 1) * limit;
    return {
      items: matches.slice(start, start + limit).map((task) => structuredClone(task)),
      total: matches.length,
    };
  }
}
