# ⚡ AutomationHub

A full-stack, production-grade automation platform: upload Excel/CSV data, get it parsed into
structured, typed datasets, then automate everything around it with workflows — scheduled jobs,
webhooks, data transforms, HTTP calls, exports, and notifications.

**Stack:** Angular 19 (standalone components, signals) · Go 1.23 (Gin + pgx) · PostgreSQL 16

## Features

- **Excel/CSV ingestion** — upload `.xlsx`/`.xlsm`/`.csv`/`.tsv`; header detection, automatic
  column type inference (string / number / boolean / date), typed JSONB storage
- **Data explorer** — server-side paginated grid with full-text search, per-column sorting
  (numeric-aware), and one-click export to Excel / CSV / JSON
- **Workflow engine** — triggers: manual · cron schedule · inbound webhook · dataset upload;
  actions: transform data (dedupe, filter, rename/drop columns, trim/case, fill empty) ·
  HTTP request · notify · export · delay
- **Scheduler** — cron entries kept in sync with workflow definitions at runtime
- **Webhooks** — each webhook-triggered workflow gets a secret URL; external systems POST to it
- **Execution history** — every run recorded with per-step logs, status, duration, and errors
- **Notifications** — in-app (with unread badge); optional email via SMTP env vars
- **Auth & roles** — JWT auth, bcrypt passwords; first registered user becomes admin;
  admins manage users and see all data, users see their own

## Running locally

Prerequisites: Go 1.23+, Node 20+, Docker.

```bash
# 1. Database (PostgreSQL 16 on host port 5434)
docker compose up -d

# 2. Backend API on :8090 (migrations run automatically)
cd backend
go run .

# 3. Frontend on :4200 (proxies /api to :8090)
cd frontend
npm install
npx ng serve
```

Open http://localhost:4200, register (first account = admin), and upload a spreadsheet.

## Configuration (env vars, all optional)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8090` | API port |
| `DATABASE_URL` | local docker Postgres on `5434` | pgx connection string |
| `JWT_SECRET` | dev value | **set a real secret in production** |
| `EXPORT_DIR` | `exports` | where export action writes files |
| `SMTP_HOST/PORT/USER/PASS/FROM` | unset | enable email notifications |

## Architecture

```
frontend/  Angular 19 — standalone components, signals, lazy routes, dark UI
backend/
  main.go                 wiring: config → db → migrate → services → router
  internal/
    config/               env config
    database/             pgx pool + embedded SQL migrations
    auth/                 JWT issue/verify
    middleware/           CORS, auth, admin role
    handlers/             REST endpoints (auth, datasets, workflows, executions,
                          webhooks, notifications, dashboard, users)
    services/
      excel.go            xlsx/csv parsing + type inference
      transform.go        dataset transform operations
      engine.go           workflow executor (steps, logs, failure notify)
      scheduler.go        cron sync for schedule-triggered workflows
      export.go           xlsx/csv/json writers
      notify.go           in-app + optional SMTP
```

**API surface:** `POST /api/auth/{register,login}` · `GET /api/auth/me` ·
`POST /api/datasets/upload` · `GET /api/datasets[/:id[/rows|/export]]` ·
CRUD `/api/workflows` + `POST /api/workflows/:id/run` ·
`GET /api/executions[/:id]` · `POST /api/hooks/:token` (public webhook) ·
`GET /api/notifications` · `GET /api/dashboard/stats` · admin `/api/users`
