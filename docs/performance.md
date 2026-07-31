# Performance and reliability guide

Performance targets protect service flow, especially when a kitchen display,
cashier, waiter, and customer phone update concurrently. Measure on target
restaurant hardware and a throttled mobile network; do not optimize only on a
developer laptop.

## Working targets

| Surface | Target |
| --- | --- |
| Public menu read | p95 API latency below 300 ms under normal restaurant load, excluding image delivery |
| Normal order mutation | p95 API latency below 500 ms after validation and persistence |
| Kitchen/cashier update | Event emitted after committed state; client feedback should feel immediate |
| Customer page | Avoid large layout shifts; give instant feedback for cart actions |
| Kitchen display | Stable during long sessions with bounded ticket history and no accumulating socket listeners |

Targets are operational signals rather than permission to ignore correctness:
financial integrity, authorization, and transition guards must remain intact
even if a slow dependency is degraded.

## Frontend practices

- Code-split panel routes and lazy-load heavy views such as reports.
- Use TanStack Query for cache, deduplication, mutation state, targeted
  invalidation, and reconnect refetching. Do not mirror all server state in a
  global store.
- Keep only local draft/cart/UI state in client state. Revalidate a persisted
  cart at checkout.
- Use stable skeleton dimensions, responsive images, lazy loading below the
  fold, and no full-resolution image in a product grid.
- Debounce search, virtualize long ticket/order lists where needed, and
  paginate history.
- Share one Socket.IO connection, remove listeners on unmount, and avoid a
  per-ticket timer that rerenders the entire board every second.
- Prefer a short, reversible optimistic update; refetch after a reconnect or
  conflict.

## API and database practices

- Store money as integer paise and centralize price calculations.
- Project only needed fields; use lean reads where appropriate and paginate
  list responses.
- Maintain indexes for restaurant/status/created-at, table session,
  ticket station/status, payment provider ID, and account role/email.
- Avoid N+1 queries and unnecessary populate chains. Aggregate reports rather
  than loading entire order histories into application memory.
- Enable compression for suitable JSON responses, cache public menu data where
  safe, and use ETags or CDN caching for static/menu images.
- Emit Socket.IO events only after the database change commits, to the narrowest
  allowed room.
- Time and log database calls, route latency, error code, socket count, ticket
  delay, and webhook-processing failures.

## Load and regression checks

Before a release, simulate concurrent menu reads/searches, waiter and cashier
order updates, a burst of kitchen tickets, payment webhooks, open-order
queries, and report generation. Capture p50/p95/p99 latency, error rate, CPU,
memory, Mongo query time, and socket stability.

Investigate changes when they introduce long tasks, layout shift, growing
listener counts, unbounded documents/queries, elevated error rates, or
database index scans. Fix measured bottlenecks; do not remove validation,
audit, or authorization as a shortcut.

## Connection-loss behavior

Show Connected, Reconnecting, Offline, and Syncing states. On reconnect,
reload authoritative orders/tickets/tables and resolve version conflicts.
Only queue non-financial actions that are explicitly safe to replay with an
idempotency key. Never mark Razorpay verification, settlement, refund, or a
payment successful from offline browser state.
