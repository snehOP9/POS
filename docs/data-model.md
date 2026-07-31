# Data model and invariants

The database is MongoDB, but the operational domain is deliberately structured
instead of storing arbitrary JSON blobs. All timestamps are stored in UTC and
displayed in the configured restaurant time zone (Asia/Kolkata by default).

## Core collections

| Collection | Purpose | Key invariants |
| --- | --- | --- |
| Account | Customer and staff identity | Password hash is never serialized; active role/permissions are checked per request. |
| RestaurantConfig | Single restaurant configuration | Currency, time zone, tax/service, feature flags, branding, and provider public config are centralized. |
| Category / MenuItem / ModifierGroup | Sellable catalogue | Archive/inactivate items referenced by history instead of hard deleting them. |
| DiningTable / TableSession | Physical table and visit context | QR token is opaque/non-predictable; only one permitted active session per table. |
| Order | Commercial record and lifecycle | Embedded item/modifier/pricing snapshot; version and valid transition guard. |
| Payment | Payment intent/settlement/refund lifecycle | Provider reference is unique; amounts are integer paise; provider events are idempotent. |
| KitchenTicket | Station-facing work unit | Contains the relevant order snapshot/round and preparation status only. |
| Shift | Cashier opening/closing and reconciliation | One governed open shift per register/cashier policy; discrepancy is recorded. |
| Notification | Targeted operational alert | Scoped to intended role/account/order and may be marked read. |
| AuditLog | Significant immutable actions | Actor, role, entity, before/after safe context, timestamp, and request ID are retained. |

## Relationship sketch

~~~text
RestaurantConfig
  ├─ Category ──< MenuItem >── ModifierGroup
  ├─ DiningTable ──< TableSession ──< Order
  ├─ Account (customer/staff) ──< Order / Shift / AuditLog
  └─ Order ──< Payment
             ├─< KitchenTicket
             ├─< Notification
             └─ embedded item, modifier, price, and timeline snapshots
~~~

## Order snapshot

An order should retain:

- ordering mode, table/pickup context, customer reference where permitted, and
  source/actor;
- item name/SKU/category, variant, modifiers, quantity, notes, dietary/allergen
  details needed for fulfillment;
- base/modifier subtotal, discount, tax, service/packaging charge, round
  adjustment, grand total, paid/refunded/balance values in paise;
- item statuses, order status, monotonic version, kitchen-ticket links, and a
  timeline with previous/new status, actor, source, note, and timestamp.

Menu descriptions/prices can change after an order is placed without changing
the historical receipt. Do not expose internal kitchen/cashier notes to
customers.

## Index and retention checklist

- Restaurant/status/created-at compound indexes support active queues and
  reports.
- Table-session lookup supports live dine-in views.
- Ticket station/status supports kitchen board queries.
- Provider payment ID/event ID should be uniquely indexed for idempotency.
- Account email and role support authentication and staff lookup.
- Use pagination, projection, and archival/retention policy for long-lived
  audit, notification, completed order, and report data.

Any schema/data migration must be additive and backward compatible during a
rolling deployment. Take a verified backup first and record the migration
version, actor, time, and rollback path.
