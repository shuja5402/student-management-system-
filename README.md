# EduSystem - Student Management Portal

A student management web app. Staff log in, add and search student records, edit them, and admins can delete them. When one person changes something, everyone else who has the page open sees it update.

Built with Node.js and Express on the backend, PostgreSQL for the database, React for the frontend, and Socket.IO for the live updates. It also ships with Docker, an Nginx config, a GitHub Actions workflow and a Render blueprint.

## What is in the project

| Task | Where to find it |
| --- | --- |
| WA-2 REST API | `backend/src` and the API section below |
| WA-3 React frontend | `frontend/` |
| WA-4 Deployment | `render.yaml` and the Render section below |
| WA-5 Authentication | `backend/src/controllers/authController.js` |
| WA-6 Database design | `docs/DATABASE.md` and `backend/src/db/migrations` |
| WA-7 Testing | `backend/tests` |
| WA-8 WebSockets | `backend/src/realtime` and `frontend/src/socket.js` |
| WA-9 CI/CD | `.github/workflows/ci.yml` |
| WA-10 Docker and Nginx | `docker-compose.yml`, the two Dockerfiles, `nginx/default.conf` |

## Folder layout

```
backend/        Express API, migrations, tests, Dockerfile
frontend/       React app (Vite), Dockerfile
nginx/          Nginx config used by the Docker setup
docs/           Database design notes
render.yaml     Render deployment blueprint
docker-compose.yml
```

## Running it on your computer

You need Node.js 20 or newer and PostgreSQL.

1. Create an empty database:

   ```bash
   createdb edusystem
   ```

2. Install everything and create `backend/.env` with random secrets:

   ```bash
   npm run setup
   ```

3. Open `backend/.env` and change `DATABASE_URL` to match your own PostgreSQL username and password.

4. Start the API and the website in two terminals:

   ```bash
   npm run dev:api
   npm run dev:web
   ```

5. Open http://localhost:5173 and create an account. The first account created becomes the admin.

If you want sample students, run `npm run seed`.

To run it the way it runs in production, as one server:

```bash
npm run build
npm start
```

That serves both the site and the API on http://localhost:4000. If you run it in production mode over plain http, set `COOKIE_SECURE=false` in `backend/.env`.

## Running it with Docker

```bash
cp .env.example .env
docker compose up --build
```

Fill in `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET` and `DATA_ENCRYPTION_KEY` in the `.env` file first. Then open http://localhost:8080. Nginx serves the React build and passes `/api` and `/socket.io` to the API container. The database is kept in a Docker volume, so it survives restarts.

## Deploying on Render

1. Push the repository to GitHub.
2. In Render, choose New, then Blueprint, and pick the repository. `render.yaml` creates the PostgreSQL database and the web service.
3. The two secrets are generated for you. Do not change `DATA_ENCRYPTION_KEY` once you have saved phone numbers, because the stored values could not be read again.
4. When the deploy finishes, open the URL, check `/api/health`, and create the first account.

The web service builds the React app and the API serves it, so you only get one URL for everything.

If you set it up by hand instead, use `npm run build` as the build command and `npm start` as the start command. Add `DATABASE_URL`, `JWT_ACCESS_SECRET`, `DATA_ENCRYPTION_KEY`, `NODE_ENV=production` and `TRUST_PROXY=true`. If you connect to the database through its external URL, also set `DB_SSL=true`.

## Environment variables

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | yes | | Signs access tokens, 32+ characters |
| `DATA_ENCRYPTION_KEY` | yes | | Used to encrypt phone numbers, 32+ characters |
| `PORT` | no | 4000 | Port the server listens on |
| `NODE_ENV` | no | development | Set to `production` when deployed |
| `DB_SSL` | no | false | Use TLS for the database connection |
| `ACCESS_TOKEN_TTL` | no | 15m | How long an access token lasts |
| `REFRESH_TOKEN_DAYS` | no | 7 | How long a login session lasts |
| `BCRYPT_ROUNDS` | no | 12 | Password hashing cost |
| `CORS_ORIGINS` | no | empty | Other origins allowed to call the API |
| `TRUST_PROXY` | no | false | Set to true behind Nginx or Render |
| `COOKIE_SECURE` | no | true in production | Marks the session cookie as Secure |
| `AUTO_MIGRATE` | no | true | Run database migrations on start |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | no | | Create this admin account on first start |

## API reference

All routes start with `/api` and use JSON. Protected routes need the header `Authorization: Bearer <accessToken>`. Without a valid token the API replies `401`.

Errors look like this:

```json
{ "error": "Validation failed", "details": [{ "field": "email", "message": "Enter a valid email address" }] }
```

`details` only appears for validation errors.

### Status codes

| Code | Meaning |
| --- | --- |
| 200 | OK |
| 201 | Created |
| 204 | Done, nothing to return (logout) |
| 400 | Bad input: failed validation, broken JSON, invalid id |
| 401 | No token, bad or expired token, or wrong login |
| 403 | Logged in but not allowed to do this |
| 404 | Record or route not found |
| 409 | Duplicate email or roll number |
| 413 | Request body too large |
| 429 | Too many requests, or account temporarily locked |
| 500 | Server error (details are only logged on the server) |

### Health check

`GET /api/health` (public)

```json
{ "status": "ok", "database": "up", "uptime": 42 }
```

### Register

`POST /api/auth/register` (public)

| Field | Rule |
| --- | --- |
| name | 2 to 100 characters |
| email | valid email, saved in lower case |
| password | 8 to 72 characters with at least one letter and one number |

Request:

```json
{ "name": "Aarav Sharma", "email": "aarav@example.com", "password": "Passw0rdOK" }
```

Response `201`:

```json
{
  "user": { "id": 1, "name": "Aarav Sharma", "email": "aarav@example.com", "role": "admin" },
  "accessToken": "<jwt>"
}
```

The first account is the admin, later ones are `staff`. The refresh token comes back as an HttpOnly cookie. Returns `409` if the email is already used.

### Login

`POST /api/auth/login` (public)

```json
{ "email": "aarav@example.com", "password": "Passw0rdOK" }
```

Returns the same shape as register with `200`. A wrong email and a wrong password give the same `401` message. After 5 failed attempts the account is locked for 15 minutes and the API returns `429`.

### Refresh

`POST /api/auth/refresh` (uses the session cookie, no body)

Returns a new `accessToken` and `user`, and replaces the cookie. Returns `401` if the cookie is missing, expired or already used.

### Logout

`POST /api/auth/logout`

Returns `204`, ends the session and clears the cookie.

### Current user

`GET /api/auth/me` (token required)

```json
{ "user": { "id": 1, "name": "Aarav Sharma", "email": "aarav@example.com", "role": "admin" } }
```

### Students

Every student route needs a token. Admins and staff can create, read and update. Only admins can delete.

A student looks like this:

```json
{
  "id": 1,
  "name": "Aarav Sharma",
  "rollNumber": "101",
  "batch": "2026",
  "course": "CSE",
  "email": "aarav@example.com",
  "createdAt": "2026-11-18T05:24:05.662Z",
  "updatedAt": "2026-11-18T05:24:05.662Z"
}
```

The responses for a single student, create and update also include `phone`. The list does not.

#### List students

`GET /api/students`

| Query | Default | Meaning |
| --- | --- | --- |
| search | | matches name, email or roll number |
| course | | filter by course |
| batch | | filter by batch |
| page | 1 | page number |
| limit | 10 | 1 to 100 |
| sort | id | `id`, `name`, `rollNumber`, `course`, `batch`, `createdAt` |
| order | asc | `asc` or `desc` |

Response `200`:

```json
{
  "data": [ { "id": 1, "name": "Aarav Sharma", "rollNumber": "101", "batch": "2026", "course": "CSE", "email": "aarav@example.com" } ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

#### Dashboard counts

`GET /api/students/stats`

```json
{ "totalStudents": 1, "totalCourses": 1, "totalBatches": 1 }
```

#### Get one student

`GET /api/students/:id`

Returns `200` with `{ "data": { ...student, "phone": "+919876543210" } }`, or `404` with `{ "error": "Student not found" }`. An id that is not a number returns `400`.

#### Create a student

`POST /api/students`

| Field | Rule |
| --- | --- |
| name | 2 to 100 characters |
| rollNumber | up to 30 characters: letters, numbers, `-`, `_`, `/`. Must be unique |
| batch | up to 20 characters |
| course | up to 80 characters |
| email | valid email, must be unique |
| phone | optional, 7 to 15 digits with an optional leading `+`. Saved encrypted |

```json
{ "name": "Aarav Sharma", "rollNumber": "101", "batch": "2026", "course": "CSE", "email": "aarav@example.com", "phone": "+919876543210" }
```

Returns `201` with the new student. Returns `400` for bad input and `409` for a duplicate:

```json
{ "error": "A student with this roll number already exists" }
```

#### Update a student

`PUT /api/students/:id`

Takes the same body as create and replaces the record. Returns `200` with the updated student, `404` if it does not exist, or `409` for a duplicate.

#### Delete a student

`DELETE /api/students/:id` (admin only)

Returns `200` with `{ "message": "Student deleted", "id": 1 }`. Staff get `403`. A missing record gets `404`.

### Audit log

`GET /api/audit-logs?limit=50` (admin only)

Lists the latest logins, failed logins, sign-ups and student changes, newest first.

### Live updates

Connect with Socket.IO to the same address and pass the token: `io({ auth: { token } })`. Connections without a valid token are refused. The server sends these events:

| Event | Data |
| --- | --- |
| `student:created` | `{ student, by }` |
| `student:updated` | `{ student, by }` |
| `student:deleted` | `{ id, by }` |
| `presence` | `{ online }` |

`by` is the id of the user who made the change. Phone numbers are never sent in these events.

## How data is kept safe

- Passwords are hashed with bcrypt and the plain password is never stored.
- Access tokens last 15 minutes. The session cookie is HttpOnly and SameSite=Strict, and only a hash of it is saved in the database. It changes on every refresh, and reusing an old one ends the whole session.
- Accounts lock for 15 minutes after 5 wrong passwords.
- Phone numbers are encrypted with AES-256-GCM before they are saved.
- Every SQL query uses parameters, and request bodies are validated and limited in size.
- Helmet security headers and rate limiting are switched on.
- Server errors are logged privately and clients only see a generic message.
- Role checks run on the server, not just in the UI.

## Tests

Create a separate empty test database, then run:

```bash
cd backend
npm install
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/edusystem_test npm test
```

The tests clear their tables each time, so never point them at a database with real data. They cover registration and login, password hashing, lockout, session refresh, protected routes, validation, duplicates, roles, search and paging, phone encryption, the audit log and the live events.

## CI/CD

The workflow in `.github/workflows/ci.yml` runs on every push and pull request. It runs the backend tests against a real PostgreSQL, builds the frontend, builds the Docker images and starts the whole stack for a quick smoke test through Nginx. On pushes to `main` it can also trigger a Render deploy if you add a `RENDER_DEPLOY_HOOK_URL` secret in the repository settings.

## Database

The table design, indexes and reasoning are written up in [docs/DATABASE.md](docs/DATABASE.md).
