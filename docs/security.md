# Security checklist and operating policy

## Required controls

- Use Helmet/security headers, a restrictive CORS allowlist, compression, body
  size limits, and structured error handling.
- Require a valid access token, active account, allowed role, required
  permission, restaurant/resource ownership, and valid state transition for
  every protected mutation.
- Validate request data with Zod and explicitly map writable fields. Never
  spread a request body into a MongoDB model.
- Use bcrypt or Argon2 password hashing; never log, return, or seed production
  passwords.
- Issue short-lived access tokens and rotate longer-lived refresh credentials.
  Deliver refresh credentials only in secure HTTP-only cookies.
- Enable HTTPS and COOKIE_SECURE=true in production. Set the cookie domain and
  SameSite policy to the actual deployment topology.
- Rate-limit login, recovery, payment, and public abuse-prone routes. Return
  a generic recovery response to avoid account enumeration.
- Use request IDs and redact stack traces, credentials, payment signatures,
  customer-secret notes, and card data from logs.

## Secrets and environments

Copy .env.example instead of committing an .env file. Generate distinct,
high-entropy JWT_ACCESS_SECRET and JWT_REFRESH_SECRET values for each
environment. Store production values in a deployment secret manager, not
Docker image layers, browser builds, tickets, or shell history.

RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET are API-only. VITE_* variables
are public by design; never place a secret in one. Rotate a credential
immediately after suspected exposure, invalidate affected sessions where
appropriate, and preserve the audit trail.

## Payment integrity

- Calculate all prices, discounts, tax, service charge, and settlement amounts
  on the API in integer paise.
- Create provider orders from server-calculated amounts only.
- Verify checkout signatures and webhook signatures on the server.
- Keep webhook handling idempotent by provider event/payment identifier.
- Prevent duplicate settlement and payment verification; model pending and
  refund states explicitly.
- Do not store card details, raw payment signatures, or provider secrets.

## Upload and input handling

Allow only expected image MIME types/extensions, enforce size and dimension
limits, randomize storage names, and strip unnecessary metadata. Encode
untrusted text on rendering, reject Mongo operators and unknown fields, and
validate object IDs, enum values, quantity limits, and price boundaries.

## Socket and proxy controls

Authenticate Socket.IO during connection, derive rooms on the server, and
authorize each subscription/action. Restrict browser origins to the configured
client origin. At the reverse proxy, forward the scheme and client address,
keep the Socket.IO upgrade path explicit, and terminate TLS before public
traffic reaches the API.

## Security verification before release

- Customer cannot access another customer order or any cashier route.
- Waiter cannot refund; kitchen cannot read reports or payment metadata.
- Invalid/expired tokens, NoSQL operators, malformed IDs, oversized bodies,
  dangerous uploads, XSS notes, role escalation, and mass assignment fail
  safely.
- Repeated login attempts are limited; refresh rotation and logout invalidate
  the intended session.
- Razorpay signature mismatch, duplicate webhook, duplicate payment verify,
  amount mismatch, and duplicate settlement are safe and auditable.
- Production error responses contain no stack trace or sensitive details.

## Incident response

1. Contain: revoke exposed credentials, disable affected accounts/keys, and
   stop unsafe traffic at the edge.
2. Preserve: retain relevant structured logs, request IDs, audit records, and
   provider event identifiers without copying secrets into chat or tickets.
3. Assess: identify affected accounts, orders, payments, and time window.
4. Recover: rotate secrets, invalidate sessions, repair verified records, and
   confirm health and reconciliation.
5. Learn: document the cause and add a regression test/control before closing
   the incident.
