# Deployment runbook

## Environments

| Environment | Purpose | Rules |
| --- | --- | --- |
| Development | Fast local iteration | Use local MongoDB or Docker; only test payment credentials. |
| Staging | Release validation | Separate database/secrets; test webhooks and role-boundary flows. |
| Production | Restaurant operation | HTTPS, managed/secured MongoDB, secret manager, backups, monitoring, and tested rollback. |

Do not promote a development database, test secret, seeded password, or
unreviewed container directly to production.

## Local Docker stack

~~~powershell
Copy-Item .env.example .env
docker compose up --build
docker compose ps
~~~

The stack exposes web at http://localhost:8080, API at
http://localhost:4000, and MongoDB at localhost:27017. Nginx proxies
/api and /socket.io to the internal API service. The direct API port is
exposed only for local diagnosis; do not expose it publicly in a production
network.

The API Dockerfile builds the npm workspaces from repository root and runs as a
non-root user. The web Dockerfile creates an immutable Vite build with
VITE_API_URL=/api/v1 and Nginx serves the React Router fallback.

## Production deployment sequence

1. Build and test a locked dependency set: typecheck, lint, unit/integration
   tests, browser smoke checks, and container build.
2. Take and verify a pre-release backup as described in
   [backup and restore](backup-restore.md).
3. Provision production secrets outside source control. Use independent JWT
   access/refresh secrets, production Razorpay credentials, a restricted
   CLIENT_URL, production MONGODB_URI, and COOKIE_SECURE=true.
4. Deploy the API and web images. Keep MongoDB private to the application
   network or use a managed cluster with an IP/network allowlist.
5. Terminate TLS at a load balancer or edge proxy. Redirect HTTP to HTTPS,
   forward X-Forwarded-Proto, and set HSTS only after HTTPS is proven.
6. Configure the public web origin to proxy API and Socket.IO traffic or
   configure the API CORS allowlist for the exact web origin.
7. Check health, readiness/database connectivity, logs, Socket.IO connection,
   one role-boundary request, and non-financial end-to-end order flow.
8. Monitor elevated API latency, database errors, payment/webhook failures,
   and ticket delays during the rollout. Roll back the application image if
   the release regresses; do not blindly restore data to undo code.

## Reverse proxy and HTTPS

The included nginx.conf is a container-side example. It serves the SPA,
proxies /api and /socket.io with correct upgrade headers, caches hashed assets,
and applies baseline browser headers. At the public edge:

- supply a valid certificate and modern TLS policy;
- constrain image/content origins in the CSP to approved domains;
- restrict CORS to the exact public app origin;
- preserve client/request scheme headers only from trusted proxies;
- avoid logging Authorization, Cookie, payment, or webhook-signature headers.

## Health, logs, and rollback

Use GET /health for liveness. Its data includes API service status and MongoDB
connection status; a disconnected database is not ready for order traffic.
Collect JSON/structured logs with timestamp, level, request ID, route, method,
status, duration, safe actor/entity references, and error code.

To roll back application code, redeploy the last known-good image after taking
a fresh backup. Check compatibility of any data change before rollout. Prefer
additive, backward-compatible schema evolution; run a data-update script once,
log it, and retain a verified backup until the next release has stabilized.

## Configuration reference

| Variable | Required outside local development | Notes |
| --- | --- | --- |
| NODE_ENV, PORT | Yes | Production runtime mode and API listener. |
| CLIENT_URL, MONGODB_URI | Yes | Exact browser origin and private/managed database URI. |
| JWT_ACCESS_SECRET, JWT_REFRESH_SECRET | Yes | Different high-entropy secrets. |
| ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL | Yes | Short access lifetime, rotated refresh lifetime. |
| RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET | If payments enabled | Secret/key secret remain API-only. |
| RESTAURANT_TIMEZONE, LOG_LEVEL, TRUST_PROXY | Yes | Default Asia/Kolkata; trust only a known reverse proxy. |
| COOKIE_DOMAIN, COOKIE_SECURE | When cookies are used | Secure must be true over production HTTPS. |
| UPLOAD_PROVIDER, UPLOAD_PATH, MAX_UPLOAD_SIZE | If uploads enabled | Enforce type/size/dimension policy. |

See .env.example for safe placeholder names, never values.
