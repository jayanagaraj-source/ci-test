import bcrypt from 'bcryptjs';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { toPublicUser } from '../users/user.repository.js';

export function createAuthService({ users, tokens, bcryptRounds }) {
  // Compared against when the email is unknown so that login timing does not
  // reveal which accounts exist.
  let dummyHash;
  const getDummyHash = async () => (dummyHash ??= await bcrypt.hash('timing-equalizer', bcryptRounds));

  const issue = (user) => ({ user: toPublicUser(user), token: tokens.sign(user) });

  return {
    async register({ email, name, password }) {
      if (await users.findByEmail(email)) {
        throw new ConflictError('Email is already registered');
      }
      // Bootstrap: the very first account becomes the administrator.
      const role = (await users.count()) === 0 ? 'admin' : 'user';
      const passwordHash = await bcrypt.hash(password, bcryptRounds);
      const user = await users.create({ email, name, passwordHash, role });
      return issue(user);
    },

    async login({ email, password }) {
      const user = await users.findByEmail(email);
      const hash = user?.passwordHash ?? (await getDummyHash());
      const valid = await bcrypt.compare(password, hash);
      if (!user || !valid) {
        throw new UnauthorizedError('Invalid email or password');
      }
      return issue(user);
    },

    async profile(userId) {
      const user = await users.findById(userId);
      if (!user) throw new NotFoundError('User not found');
      return toPublicUser(user);
    },
  };
}
