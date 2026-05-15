# Team Task Manager (Full-Stack)

Full-stack task tracking with **React (Vite) + Bootstrap**, **Node.js (Express) REST API**, **MongoDB**, **JWT authentication**, and **project-level RBAC** (admin vs member).

## Features

- **Authentication:** Email/password signup and login; JWT stored in `localStorage`.
- **Projects:** Create projects; owners are **admins** automatically.
- **Team / RBAC:** Admins add members by email, set **admin** or **member** role, or remove members. Owners cannot be removed from their project.
- **Tasks:** Admins create tasks, assign users, set due dates, and delete tasks. **Members** may change **status** only on tasks **assigned to them**.
- **Dashboard:** Cross-project totals, status breakdown, and **overdue** counts (due date before today, status not done).

## Repository layout

- `backend/` — Express API, Mongoose models, validation, RBAC middleware.
- `frontend/` — Vite + React SPA, Bootstrap UI.

## Prerequisites

- **Node.js** 18+
- **MongoDB** (local `mongodb://127.0.0.1:27017/...` or [MongoDB Atlas](https://www.mongodb.com/atlas))

## Local development

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: MONGODB_URI, JWT_SECRET, CLIENT_ORIGIN=http://localhost:5173
npm install
npm run dev
```

API defaults to `http://localhost:5000`. Health check: `GET http://localhost:5000/api/health`.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite runs on `http://localhost:5173` and **proxies** `/api` to the backend.

Optional: copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL` if the API is not same-origin (not needed for local Vite proxy).

## API overview

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/auth/register` | `{ name, email, password }` |
| POST | `/api/auth/login` | `{ email, password }` |
| GET | `/api/auth/me` | Bearer token |
| GET/POST | `/api/projects` | List / create |
| GET/PATCH/DELETE | `/api/projects/:projectId` | Admin for PATCH/DELETE |
| POST/PATCH/DELETE | `/api/projects/:projectId/members` | Admin; PATCH `/members/:userId` body `{ role }` |
| GET/POST | `/api/projects/:projectId/tasks` | POST admin-only |
| PATCH/DELETE | `/api/projects/:projectId/tasks/:taskId` | DELETE admin-only; PATCH per RBAC |

## Deploy on Railway (example)

1. Create a **MongoDB** service (or use Atlas) and note `MONGODB_URI`.
2. Create a **Node** service from this repo (root or `backend/` — if only `backend`, set root directory in Railway to `backend`).
3. Set variables, for minimal example:
   - `MONGODB_URI`
   - `JWT_SECRET` (long random string)
   - `CLIENT_ORIGIN` — your frontend origin(s), comma-separated if needed
   - Optionally `SERVE_STATIC=1` if you build the SPA into `frontend/dist` and run the API from repo root (see below)
4. **Build command (monorepo single service):** e.g. `cd frontend && npm ci && npm run build && cd ../backend && npm ci`
5. **Start command:** `cd backend && npm start`
6. If using `SERVE_STATIC=1`, ensure `frontend/dist` exists after build relative to where `backend` resolves `../../frontend/dist` (from `backend/src/index.js`).

Alternatively, deploy **frontend** as a static site and **backend** separately; set `VITE_API_URL` at build time to the public API URL.

## Demo video

Record a short walkthrough: signup, create project, add a second user as member, create/assign tasks, show member vs admin behavior on the dashboard.

## License

Use and modify for coursework or your own projects.
