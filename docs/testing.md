# Testing and smoke checks

## Current automated coverage

The repository currently contains API unit tests for order-transition rules
and response serializers:

~~~powershell
npm run typecheck
npm run lint
npm run test
npm run test:e2e --workspace=@emberserve/web
npm run build
~~~

Focused API commands:

~~~powershell
npm run test --workspace=@emberserve/api
npm run typecheck --workspace=@emberserve/api
npm run build --workspace=@emberserve/web
~~~

The workspace linter is a strict ESLint gate. The Playwright suite runs only
against the local Vite Preview flow; it does not call an API, create Atlas
orders, or make payments. It verifies deterministic Preview cross-tab state,
the keyboard menu search, and serious/critical WCAG 2 A/AA issues through axe.
Use a disposable test database for API integration coverage; it is not yet a
substitute for browser checks.

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

## Guest checkout and synchronisation

Guest checkout is intentionally direct: it does not require a customer
account, mobile number or separate verification screen. In Preview, add a
dish from the menu, open the tray, send the order to the kitchen, and confirm
the guest tracking view updates when the Kitchen Preview marks the ticket
ready. The Playwright suite performs this browser-level flow, including the
cross-tab guest-to-kitchen update, without using a live API or creating a
payment.

For a live smoke check against a seeded disposable database, submit an
eligible guest order from a table-QR menu URL or a pickup menu flow, then sign
in as a Kitchen, Waiter or Cashier user in a separate browser session. Confirm
the new order and its kitchen tickets arrive in the appropriate staff workspace
and that subsequent staff status changes are reflected in the operational
views. Do not run this check against a restaurant's production order queue
unless the restaurant has explicitly scheduled the test.

## Planned integration coverage

The next API test layer should run against an isolated MongoDB database and
cover login/refresh/logout, menu reads, quote/order creation, waiter tables,
kitchen ticket updates, cash settlement, shifts, reports, Razorpay order and
signature verification, webhooks, and refunds. Assertions should verify both
the response and persisted invariants such as paise totals, audit events,
access control, snapshots, and provider-event idempotency.

## Planned end-to-end coverage

Add a browser runner such as Playwright for these flows:

1. Direct guest pickup from menu through test payment and kitchen-ready
   update.
2. Dine-in table context, waiter/kitchen updates, service, and settlement.
3. Waiter second round, ensuring only newly sent items reach the next ticket.
4. Authorized cancellation/refund with an audit record.
5. Concurrent staff edits that produce a visible version conflict rather than
   silently losing an item.

When browser tests are introduced, include role-boundary, keyboard/focus,
reduced-motion, contrast, and live-update checks alongside an automated
accessibility scan.

## Verified role-panel smoke pass

Use a browser at `http://localhost:5173` so it matches the local `CLIENT_URL`
CORS setting. Against a seeded disposable database, verify:

1. Waiter: sign in, select an available table, set guest count and a seating
   note, refresh, confirm both persisted, then close the empty session.
2. Cashier: sign in, open Reports, Tables, Orders, Payments, and Shift; verify
   each panel loads without a console or API error. Do not close a pre-existing
   shift during verification.
3. Kitchen: sign in, switch a station filter, and toggle kitchen alerts.
4. Customer: verify no-QR menu ordering disables dine-in selection and a valid
   table QR context enables it.

The local `127.0.0.1` origin is not an equivalent smoke target unless it is
explicitly added to the development API CORS allowlist.

## Health endpoint semantics

- `GET /health` is a public liveness probe. It reports only that the API process is serving requests and intentionally does not expose dependency state.
- `GET /ready` is a readiness probe. It returns HTTP 200 when required database connectivity is available and HTTP 503 otherwise, without returning the raw database connection state.
