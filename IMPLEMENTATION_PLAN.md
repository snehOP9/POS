# EmberServe POS — implementation plan

## 1. Assumptions

- This is a single restaurant modular monolith, with `Asia/Kolkata` and INR as defaults configured centrally.
- The first delivery runs locally with MongoDB (Docker-supported), Razorpay test credentials, and seeded demonstration accounts.
- Delivery remains feature-flagged off. The supplied scope is implemented as a working foundation with secure domain boundaries rather than a collection of static mock screens.

## 2. Functional requirements

1. Four route-specific experiences: public customer menu, cashier POS, waiter table workflow, and kitchen display.
2. JWT-backed staff/customer authentication; backend role and permission enforcement.
3. Configurable menu, categories, variants, modifier choices, availability and item snapshots.
4. Dine-in, pickup and counter order creation; server-side totals, tax/service calculation and validated status transitions.
5. Kitchen tickets, item preparation controls, ready alerts, order timeline and live Socket.IO events.
6. Cashier settlement, cash-change calculation, discount guardrails, printable receipt and Razorpay test order/signature endpoints.
7. Shifts, lightweight reports, notifications, audit log records and seeded demo data.

## 3. Non-functional requirements

- TypeScript strict mode, Zod validation, Helmet/CORS/rate limiting/compression and structured errors.
- Responsive, keyboard-accessible UI with visible focus, ARIA live updates, reduced-motion support and high contrast.
- Feature-based frontend, domain-based backend, database indexes, optimistic UI and reconnect-aware sockets.
- Docker/dev environment, health endpoint, environment validation, tests and setup/deployment documentation.

## 4. Information architecture

```text
/menu       Customer discovery, cart, checkout and live tracking
/login      Shared role-aware sign in
/cashier    POS, payments, tables, shifts, reports
/waiter     Tables, in-progress orders, ready queue, alerts
/kitchen    Ticket board, station filter and preparation controls
```

## 5. Role / permission matrix

| Capability | Customer | Waiter | Kitchen | Cashier |
|---|---:|---:|---:|---:|
| Browse/menu cart | Yes | Yes | View only | Yes |
| Create order | Own | Assigned tables | No | Yes |
| Prepare items | No | No | Yes | No |
| Mark served | No | Yes | No | Yes |
| Settle/refund | Own online checkout | No | No | Permission-gated |
| Reports/settings | No | No | No | Permission-gated |

## 6. Order state diagram

```text
DRAFT → PLACED → CONFIRMED → ACCEPTED_BY_KITCHEN → PREPARING
                                      │                 │
                                      └──────────→ PARTIALLY_READY → READY → SERVED → COMPLETED
Any eligible active state → CANCEL_REQUESTED → CANCELLED
```

Item state: `PENDING → QUEUED → PREPARING → READY → SERVED`, with audited cancellation.

## 7. Data model

`Account`, `RestaurantConfig`, `Category`, `MenuItem`, `ModifierGroup`, `DiningTable`, `TableSession`, `Order`, `Payment`, `KitchenTicket`, `Shift`, `Notification` and `AuditLog` are separate Mongo collections. Orders embed immutable item, modifier, pricing and timeline snapshots. Indexed fields include restaurant/status/created-at, table session, ticket station/status, payment provider id and account role/email.

## 8. API plan

- `/api/v1/auth`: login, refresh, logout, profile
- `/api/v1/menu`: public menu, category and availability data
- `/api/v1/orders`: quote, create, list, detail, status/item transitions
- `/api/v1/tables`, `/api/v1/waiter`, `/api/v1/kitchen`: operational workflows
- `/api/v1/cashier`, `/api/v1/payments`, `/api/v1/shifts`, `/api/v1/reports`: protected operational APIs
- `/health`: service and database health

All mutation routes use Zod validation, authentication, role/permission checks, version/transition guards and standardized error envelopes.

## 9. Real-time event plan

Socket rooms isolate restaurant, role and order audiences. The API emits `order:created`, `order:updated`, `ticket:updated`, `item:ready`, `table:updated`, `payment:updated` and `notification:created`. Clients invalidate/refetch on reconnect and use transient optimistic state only.

## 10. Design system proposal

Saffron Noir uses charcoal operational surfaces, warm cream customer backgrounds, saffron primary actions, herb-green success, ruby urgency and muted copper accents. Components share durable status pills, tray-like cards, food image treatments, large touch controls, skeletons and short reduced-motion-safe feedback.

## 11. Screen wireframes

- **Customer:** discovery header, hero, category rail, food cards, sticky cart and tracking drawer.
- **Cashier:** category rail + product grid + persistent live bill / settlement column.
- **Waiter:** table map/cards, selected table order sheet, ready-to-serve strip.
- **Kitchen:** dark ticket grid, elapsed timers, station controls and large prep / ready actions.

## 12. Project structure and implementation phases

```text
frontend        Vite + React client, grouped by panel
backend         Express + Socket.IO + Mongoose API
packages/shared shared types, constants and validation
docs            architecture, API, operations and checklists
docker-compose.yml, .env.example, README.md
```

1. Foundation: workspaces, configuration, auth/security, theme/layouts.
2. Menu and pricing: models, seed data, public menu and cart.
3. Orders: table sessions, server pricing, lifecycle and role workflows.
4. Kitchen/realtime: tickets, item controls, events and alerts.
5. Payments/operations: Razorpay test integration, shifts, receipts and reports.
6. Hardening: tests, accessibility, Docker and operational documentation.
