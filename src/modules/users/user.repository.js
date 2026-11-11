import { randomUUID } from 'node:crypto';

/**
 * In-memory user store. Implements the same async interface a database-backed
 * repository would, so it can be swapped without touching services.
 */
export class InMemoryUserRepository {
  #byId = new Map();
  #idByEmail = new Map();

  async create({ email, name, passwordHash, role }) {
    const user = {
      id: randomUUID(),
      email,
      name,
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
    };
    this.#byId.set(user.id, user);
    this.#idByEmail.set(email, user.id);
    return structuredClone(user);
  }

  async findById(id) {
    const user = this.#byId.get(id);
    return user ? structuredClone(user) : null;
  }

  async findByEmail(email) {
    const id = this.#idByEmail.get(email);
    return id ? this.findById(id) : null;
  }

  async list() {
    return [...this.#byId.values()].map((user) => structuredClone(user));
  }

  async count() {
    return this.#byId.size;
  }
}

export const toPublicUser = ({ passwordHash: _omit, ...user }) => user;
