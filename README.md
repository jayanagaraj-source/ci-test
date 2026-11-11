# TaskFlow API

A task management REST API built with Node.js and Express 5. It includes JWT authentication, role-based access control, schema validation, optimistic concurrency and live updates over Server-Sent Events.

## Features

- **Layered modules**: routes → controller → service → repository, wired in one composition root (`src/app.js`).
- **Auth**: register/login with bcrypt hashing, HS256 JWTs, and constant-time handling of unknown emails. The first user to register becomes `admin`.
- **RBAC**: users see only their own tasks. Admins see all tasks and the user directory. Another user's task returns `404`, so its existence isn't revealed.
- **Validation**: strict Zod schemas for body, query and params, with structured `400` errors.
- **Optimistic concurrency**: each task has a version, exposed as an `ETag`. Send `If-Match` on a `PATCH` and a stale write gets `412`.
- **Live updates**: `GET /api/v1/tasks/events` streams `task.created` / `task.updated` / `task.deleted` as SSE, filtered per user.
- **Hardening**: Helmet, CORS allow-list, global and auth-specific rate limits, 100 kb body limit, sanitized `X-Request-Id`, and redacted structured logs (pino).
- **Operations**: liveness and readiness probes, graceful shutdown, fail-fast config validation, non-root Docker image.

## Quick start

```bash
cp .env.example .env      # set JWT_SECRET
npm install
npm run dev
```

## API

| Method | Path | Auth |
|---|---|---|
| GET | `/health/live`, `/health/ready` | – |
| POST | `/api/v1/auth/register` | – |
| POST | `/api/v1/auth/login` | – |
| GET | `/api/v1/auth/me` | user |
| GET | `/api/v1/users` | admin |
| GET | `/api/v1/tasks?status=&priority=&tag=&q=&sort=&order=&page=&limit=` | user |
| POST | `/api/v1/tasks` | user |
| GET / PATCH / DELETE | `/api/v1/tasks/:id` | owner or admin |
| GET | `/api/v1/tasks/events` (SSE) | user |

## Scripts

`npm test` · `npm run test:coverage` · `npm run lint` · `npm start`

## Security scanning

`.github/workflows/tigergate.yml` runs the TigerGate CLI on every push and PR to `main`, and can also be started manually. It scans the checked-out repository and installs nothing. SCA uses the committed `package-lock.json`.

Required settings: secret `TIGERGATE_API_KEY`. Optional variables: `TIGERGATE_API_URL`, `TIGERGATE_CLI_IMAGE`, `TIGERGATE_CLI_TAG`.
