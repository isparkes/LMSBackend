# LMS Training Backend

A Learning Management System backend built with NestJS, TypeScript, and PostgreSQL.

See [SPECIFICATION.md](SPECIFICATION.md) for full details.

## Related Projects

- **[TrainingFrontend](../TrainingFrontend)** — Next.js web UI for learners and admins

## Quick Start

```bash
# Start PostgreSQL
docker compose up -d

# Install dependencies
npm install

# Start in development mode (with hot reload)
npm run start:dev

# Seed the admin user (admin@example.com / admin123)
npm run seed:admin

# Build for production
npm run build
npm run start:prod
```

The API runs on `http://localhost:3000` with all routes prefixed under `/api`.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| DB_HOST | No | `localhost` | PostgreSQL host |
| DB_PORT | No | `5432` | PostgreSQL port |
| DB_USERNAME | Yes | — | Database user |
| DB_PASSWORD | Yes | — | Database password |
| DB_NAME | Yes | — | Database name |
| JWT_SECRET | Yes | — | JWT signing key |
| JWT_EXPIRATION | No | `1d` | Token lifetime |
| PORT | No | `3000` | Server listen port |

## API Overview

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/profile` |
| Courses | CRUD at `/api/courses` (admin creates, learners see published only) |
| Modules | CRUD at `/api/courses/:courseId/modules` |
| Lessons | CRUD at `/api/modules/:moduleId/lessons` (types: text, video, pdf, quiz) |
| Quiz | Questions CRUD at `/api/lessons/:lessonId/questions`, submit at `/api/lessons/:lessonId/submit`, attempts at `/api/lessons/:lessonId/attempts` |
| Progress | `POST /api/progress/complete`, `GET /api/progress/courses/:courseId`, admin overview and per-user detail |
| Users | `GET /api/users`, `GET /api/users/:userId`, `PATCH /api/users/:userId/password` (admin only) |
| Uploads | Upload, list, rename, and delete at `/api/uploads/video`, `/api/uploads/pdf`, `/api/uploads/videos`, `/api/uploads/pdfs` |
| Static files | `GET /uploads/videos/*`, `GET /uploads/pdfs/*` |
