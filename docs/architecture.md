# Architecture

EmberServe POS is a single-restaurant modular monolith. It keeps the
operational domains together for simple deployment while preserving clear
boundaries so that a busy kitchen, cashier terminal, waiter tablet, and
customer phone remain coordinated.

## System map

~~~text
                    Browser clients
   customer / cashier / waiter / kitchen React routes
                         |
              HTTPS + REST + Socket.IO
                         |
             Nginx (production edge)
                |                |
             static web       /api and sockets
                                  |
                 Express API + Socket.IO
  auth | menu | tables | orders | kitchen | payments
  shifts | reports | notifications | audit | config
                                  |
                               MongoDB
~~~

The React application owns presentation, local drafts, and reconnect-aware
query invalidation. The Express API is authoritative for authentication,
permissions, prices, order transitions, payment verification, and persisted
state. Browser clients must never treat a displayed total or a local order
state as authoritative.

## Modules and ownership

| Module | Responsibilities | Important boundary |
| --- | --- | --- |
| Auth/accounts | Login, refresh/logout, active-account checks, roles | Password hashes and refresh-token material never leave the API. |
| Menu | Categories, items, modifiers, availability | Historical orders store item/pricing snapshots. |
| Tables/waiter | Table sessions, guest count, waiter workflows | A table token is context, not customer authentication. |
| Orders | Quotes, server-side pricing, lifecycle, idempotency/version checks | Only valid lifecycle transitions may persist. |
| Kitchen | Tickets, stations, item preparation state | Kitchen users do not receive financial or customer-secret fields. |
| Cashier/payments | Settlement, discounts, refunds, Razorpay verification | Amounts use integer paise; provider secrets remain server-only. |
| Shifts/reports | Open/close shifts and aggregated operational data | Sensitive reports require elevated cashier permission. |
| Notifications/audit | Real-time alerts and immutable significant-action records | Audit records are append-only during ordinary operation. |

## Role model

| Capability | Customer | Waiter | Kitchen | Cashier |
| --- | ---: | ---: | ---: | ---: |
| Browse/menu cart | Own | Yes | View only | Yes |
| Create an order | Own | Assigned table | No | Yes |
| Kitchen preparation | No | No | Yes | No |
| Mark items served | No | Yes | No | Yes |
| Settlement/refund | Own online flow | No | No | Permission-gated |
| Reports/settings | No | No | No | Permission-gated |

Role checks are enforced on the API, not merely by hiding navigation. Cashier
permissions further gate discounts, refunds, reports, configuration, shifts,
and staff administration.

## Order and payment integrity

~~~text
DRAFT -> PLACED -> CONFIRMED -> ACCEPTED_BY_KITCHEN -> PREPARING
                                                     |
                                                     v
                                             PARTIALLY_READY -> READY
                                                               |
                                                               v
                                                         SERVED -> COMPLETED

Eligible active states -> CANCEL_REQUESTED -> CANCELLED
Item: PENDING -> QUEUED -> PREPARING -> READY -> SERVED
~~~

The API evaluates permitted transitions using the actor role, current state,
version, and payment state. It records significant changes in the order
timeline and audit log. Financial totals are calculated once by a central
pricing service in paise and captured as an immutable order snapshot.

## Data design

MongoDB collections include Account, RestaurantConfig, Category, MenuItem,
ModifierGroup, DiningTable, TableSession, Order, Payment, KitchenTicket,
Shift, Notification, and AuditLog. Orders embed immutable item, modifier,
price, and timeline snapshots so later menu changes cannot rewrite history.

Indexes should cover restaurant/status/created-at, table session,
ticket station/status, payment provider identifier, and account role/email.
List APIs must use projection and pagination rather than returning historical
collections wholesale.

## Real-time design

Socket rooms isolate restaurant, role, and order audiences. After a committed
change, the API emits the smallest relevant event:

- order:created and order:updated
- ticket:updated and item:ready
- table:updated
- payment:updated
- notification:created

Clients should apply a small optimistic update only when rollback is obvious.
On reconnect they must refetch the authoritative query data, retain safe draft
state, and avoid replaying financial actions. A safe offline waiter queue, if
enabled, needs a client idempotency key, device identifier, timestamp, retry
count, and a clear conflict-resolution screen.

## Deployment shape

Local Docker Compose starts MongoDB, the API, and the Nginx-served web build.
The production web container forwards API and Socket.IO traffic to the API
container. HTTPS terminates at a trusted load balancer or edge proxy. See
[deployment](deployment.md) and [backup and restore](backup-restore.md) for
the operational controls around this shape.
