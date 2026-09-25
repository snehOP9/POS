# Testing and smoke checks

## Current automated coverage

The repository currently contains API unit tests for order-transition rules
and response serializers:

~~~powershell
npm run typecheck
npm run test
npm run build
~~~

Focused API commands:

~~~powershell
npm run test --workspace=@emberserve/api
npm run typecheck --workspace=@emberserve/api
npm run build --workspace=@emberserve/web
~~~

There is no configured workspace linter, integration-test suite, or
Playwright/Cypress runner at present. Do not describe those as existing
automated coverage.

## Current smoke checks

Start a MongoDB instance, seed a disposable development database, then start
the applications:

~~~powershell
npm run seed
npm run dev
Invoke-RestMethod http://localhost:4000/health
Invoke-RestMethod http://localhost:4000/ready
~~~

For the Docker stack, use:

~~~powershell
docker compose up --build
Invoke-RestMethod http://localhost:4000/health
Invoke-RestMethod http://localhost:4000/ready
Invoke-WebRequest http://localhost:8080/ -UseBasicParsing
docker compose ps
docker compose logs api --tail=100
~~~

The health response should identify emberserve-api with status ok and database
connected. Credential-dependent checks require that the target database has
already been seeded. Then sign in with each development role, confirm the
allowed panel route, create a non-financial test order, observe the kitchen
update, and confirm a forbidden role receives a safe 403 response.

Never perform a real payment or production refund as a smoke check. Use
Razorpay test mode and a disposable database.

## Planned integration coverage

The next API test layer should run against an isolated MongoDB database and
cover login/refresh/logout, menu reads, quote/order creation, waiter tables,
kitchen ticket updates, cash settlement, shifts, reports, Razorpay order and
signature verification, webhooks, and refunds. Assertions should verify both
the response and persisted invariants such as paise totals, audit events,
access control, snapshots, and provider-event idempotency.

## Planned end-to-end coverage

Add a browser runner such as Playwright for these flows:

1. Customer pickup from menu through verified test payment and kitchen-ready
   update.
2. Dine-in table context, waiter/kitchen updates, service, and settlement.
3. Waiter second round, ensuring only newly sent items reach the next ticket.
4. Authorized cancellation/refund with an audit record.
5. Concurrent staff edits that produce a visible version conflict rather than
   silently losing an item.

When browser tests are introduced, include role-boundary, keyboard/focus,
reduced-motion, contrast, and live-update checks alongside an automated
accessibility scan.


## Health endpoint semantics

- `GET /health` is a public liveness probe. It reports only that the API process is serving requests and intentionally does not expose dependency state.
- `GET /ready` is a readiness probe. It returns HTTP 200 when required database connectivity is available and HTTP 503 otherwise, without returning the raw database connection state.
