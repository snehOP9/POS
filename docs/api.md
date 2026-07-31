# API contract

Base URL: /api/v1. The API uses JSON and a versioned REST surface. The
unauthenticated health endpoint is outside that prefix at /health.

## Authentication

Access tokens are sent as Bearer tokens. Login and refresh also set the
emberserve_refresh HTTP-only cookie; browser clients must send credentials for
refresh requests and must not read or store that refresh credential.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | /auth/login | Public | Sign in with email and password; returns an access token and sets the refresh cookie. |
| POST | /auth/refresh | Refresh cookie | Rotates the refresh credential and returns a new access token. |
| POST | /auth/logout | Bearer token | Revokes the current account token version and clears the refresh cookie. |
| GET | /auth/me | Bearer token | Returns the active account profile, role, and permissions. |

Authentication requests are rate-limited. The API rejects inactive accounts
and never returns password hashes.

## Response and error envelopes

Successful responses have data and, for paginated endpoints, optional metadata:

~~~json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 0
  }
}
~~~

Central application errors place the correlation value inside error. Every
response also has an X-Request-Id header.

~~~json
{
  "success": false,
  "error": {
    "code": "ORDER_INVALID_TRANSITION",
    "message": "This order cannot move to the requested state.",
    "details": {},
    "requestId": "correlation-id"
  }
}
~~~

Use stable error codes in clients. Common HTTP meanings are 400 validation or
invalid input, 401 authentication/session failure, 403 authorization failure,
404 missing route/resource, 409 state/version conflict, 429 rate limit, and
500 server failure.

## Public catalogue and quote routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /menu | List/filter the public menu. |
| GET | /menu/:id | Read one public menu item. |
| GET | /tables/resolve/:token | Resolve an opaque table QR token. |
| POST | /orders/quote | Validate selected items and return server-calculated pricing. |

Public menu responses omit staff-only and payment information. A table token
establishes table context; it is not customer authentication.

## Authenticated operations

| Area | Current routes | Access |
| --- | --- | --- |
| Orders | POST /orders; GET /orders; GET /orders/:id; PATCH /orders/:id/status; PATCH /orders/:id/items/:lineId/status | Customer, waiter, or cashier as permitted; kitchen uses ticket workflows instead. |
| Tables | GET /tables; POST /tables/:id/session; POST /tables/:id/close | Waiter or cashier. |
| Waiter | GET /waiter/tables; POST /waiter/tables/:id/open; POST /waiter/tables/:id/orders; POST /waiter/orders/:id/bill-request | Waiter. |
| Kitchen | GET /kitchen/tickets; PATCH /kitchen/tickets/:id/status; PATCH /kitchen/tickets/:id/items/:lineId/status | Kitchen. |
| Kitchen priority | PATCH /kitchen/tickets/:id/priority | Cashier with the required supervisor permission. |
| Cashier | GET/POST /cashier/orders; PATCH /cashier/orders/:id/discount; GET /cashier/orders/:id/receipt | Cashier, with permission checks for restricted actions. |
| Menu administration | POST /menu/categories; POST /menu/items; PATCH /menu/items/:id/availability | Cashier with the corresponding configuration/availability permission. |
| Payments | POST /payments/cash; POST /payments/razorpay/order; POST /payments/razorpay/verify; POST /payments/:id/refund | Cash, refund, and provider actions are role/permission constrained. |
| Shifts and reports | GET /shifts/current; POST /shifts/open; POST /shifts/close; GET /reports/summary | Cashier with the required shift/report permission. |
| Notifications | GET /notifications; PATCH /notifications/:id/read | Authenticated account, scoped to its own notifications. |

The Razorpay webhook is POST /api/v1/payments/razorpay/webhook. It receives
the raw request body before JSON parsing so the provider signature can be
verified.

All request data is Zod-validated and writable fields are explicitly mapped.
Order and item changes may require expectedVersion; callers must refetch and
reconcile after a 409 conflict. Money is represented in integer paise.

## Health and real-time

GET /health returns 200 only when MongoDB is connected; otherwise it returns
503 with a degraded status.

~~~json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "emberserve-api",
    "database": "connected",
    "timestamp": "2026-08-01T00:00:00.000Z"
  }
}
~~~

Socket.IO is served at /socket.io. The server authenticates the handshake
access token and assigns restaurant-scoped role and account rooms itself; a
client cannot choose its own room. Current emitted events are order:created,
order:updated, ticket:created, ticket:updated, item:ready, table:updated,
payment:updated, and notification:created.
