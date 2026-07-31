# EmberServe POS

EmberServe POS is a full-stack, real-time restaurant point-of-sale system for
a single restaurant. It brings customer ordering, cashier settlement, waiter
service, and kitchen preparation into one responsive application.

## Highlights

- Customer menu, cart, and order flow at `/menu`
- Role-protected cashier, waiter, and kitchen panels
- Express, MongoDB, Socket.IO, JWT access tokens, and HTTP-only refresh
  cookies
- Server-side order pricing, status transitions, kitchen tickets, payments,
  shifts, reports, and audit events
- Preview mode for safe UI exploration and seed data for local development
- Docker Compose configuration, health checks, and operational documentation

## Stack

| Area | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router, Socket.IO client |
| Backend | Express, TypeScript, Mongoose, Socket.IO, Zod, Pino |
| Data | MongoDB |
| Payments | Razorpay test-mode integration |
| Delivery | Docker, Nginx, Docker Compose |

## Project structure

```text
frontend/
  src/
    customer/       Customer menu and cart
    cashier/        Cashier POS panel
    waiter/         Table-service panel
    kitchen/        Kitchen display panel
    auth/           Staff/customer sign-in
    shared/         Shared components, state, API client, hooks, and types
backend/
  src/
    config/ domain/ lib/ middleware/ models/ routes/ services/
packages/shared/   Shared TypeScript contracts
docs/              Architecture, API, security, testing, and operations guides
```

## Prerequisites

- Node.js 20.19 or later (the Docker images use Node 22)
- npm 10 or later
- MongoDB 7 or later, or Docker Desktop

## Run locally

1. Ensure MongoDB is running. Use a native MongoDB 7+ service, or start only
   the Compose database when Docker Desktop is available.

   ```powershell
   docker compose up mongo -d
   ```

2. Create your local environment file.

   ```powershell
   Copy-Item .env.example .env
   ```

3. Set unique JWT secrets in `.env` before using anything beyond a disposable
   local environment. Keep `MONGODB_URI=mongodb://127.0.0.1:27017/emberserve`
   when using a native MongoDB service.

4. Install dependencies and seed the local development database.

   ```powershell
   npm ci
   npm run seed
   ```

5. Start the frontend and backend together.

   ```powershell
   npm run dev
   ```

Open [http://localhost:5173](http://localhost:5173). The API is available at
[http://localhost:4000](http://localhost:4000), with a health check at
[http://localhost:4000/health](http://localhost:4000/health).

## Development accounts

After `npm run seed`, use the configured `SEED_DEMO_PASSWORD` (default:
`demo-password`) with any of these accounts:

| Role | Email | Route |
| --- | --- | --- |
| Cashier | `cashier@ember.local` | `/cashier` |
| Waiter | `waiter@ember.local` | `/waiter` |
| Kitchen | `kitchen@ember.local` | `/kitchen` |
| Customer | `guest@ember.local` | `/menu` |

These are disposable development accounts only. Do not seed them into a
shared, staging, or production database.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run frontend and backend in watch mode |
| `npm run seed` | Seed the development restaurant, accounts, menu, and tables |
| `npm run typecheck` | Type-check all workspaces |
| `npm run test` | Run API unit tests |
| `npm run build` | Create production builds |

## Docker Compose

Create `.env` as above, then start the complete stack:

```powershell
docker compose up --build -d
npm ci
npm run seed
```

Open [http://localhost:8080](http://localhost:8080). Nginx serves the frontend
and proxies `/api/*` and `/socket.io/*` to the API. Compose starts its own
MongoDB container, so stop a native MongoDB instance first if it already uses
port `27017`. The seed command runs from the host against the mapped MongoDB
port; the production API container intentionally does not include the seed
tool.

## Configuration and security

- `.env`, `node_modules`, build output, logs, and uploads are ignored by Git.
- Use distinct high-entropy values for `JWT_ACCESS_SECRET` and
  `JWT_REFRESH_SECRET` outside disposable local development.
- Add actual Razorpay **test** credentials only when testing online payments;
  do not expose `RAZORPAY_KEY_SECRET` or webhook secrets to the browser.
- For deployment, set exact allowed frontend origins, use TLS, set
  `COOKIE_SECURE=true`, and use a managed or properly secured MongoDB setup.

## Verification

Before a release or pull request, run:

```powershell
npm run typecheck
npm run test
npm run build
```

Then verify `GET /health`, sign in with an appropriate role, and exercise the
relevant panel flow. See the testing guide for the full smoke-test matrix.

## Documentation

- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [API contract](docs/api.md)
- [User flows](docs/user-flows.md)
- [Security checklist](docs/security.md)
- [Accessibility checklist](docs/accessibility.md)
- [Testing guide](docs/testing.md)
- [Deployment guide](docs/deployment.md)
- [Operations runbook](docs/operations.md)
- [Backup and restore](docs/backup-restore.md)
- [Development credentials](docs/sample-credentials.md)

## Production note

This repository includes a production-shaped foundation and test-mode payment
integration. Perform infrastructure hardening, secret rotation, backup and
restore drills, payment verification, and role-boundary testing before any
production deployment.
