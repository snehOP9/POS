# Restaurant operations runbook

## Opening checks

1. Confirm public web/API health, MongoDB connection, and Socket.IO connection
   indicator on a staff device.
2. Log in as cashier; open the shift with the counted opening cash and register
   identity. Verify the audit record.
3. Confirm current menu availability, tax/service configuration, table status,
   kitchen station filter, printer/receipt path, and Razorpay mode indicator.
4. Log in once as waiter and kitchen to confirm their role-specific queues
   load. Do not share staff accounts.

## During service

- Treat the displayed connection state as operational information:
  Connected, Reconnecting, Offline, or Syncing.
- On a reconnect, allow the application to refresh authoritative table/order/
  ticket state before retrying an action.
- Do not retry a payment, refund, settlement, or Razorpay verification by
  repeatedly pressing the control. Check payment status and audit history
  first.
- Resolve an order version conflict by loading the latest order and choosing a
  deliberate reconciliation; do not overwrite a concurrent staff change.
- Use roles and permissions for discount, cancel, refund, shift, and report
  actions. Each exceptional action needs a reason and is auditable.

## Kitchen and waiter coordination

Kitchen should use ticket acceptance, preparation, item-ready, and complete
ticket actions rather than informal status assumptions. Waiters should serve
only ready items and use the ready queue/notification as the trigger. If a
ticket is missing, check connection state, station filter, API health, then
the order timeline and request ID before re-creating an order.

## Payment and reconciliation

The API-calculated order total is the financial truth. Cashiers must confirm
the selected payment method, paid amount, change, and payment state before
settlement. For Razorpay, verify the provider result through the server and
use the provider/dashboard plus payment status endpoint for ambiguous cases.
Never accept a client screenshot or browser success state as payment proof.

At close, close the shift with counted cash, record any discrepancy/reason,
check pending/failed/refund payment states, and retain the generated shift
summary. Reconcile provider transactions separately from cash handling.

## Incident triage

| Symptom | First action | Do not do |
| --- | --- | --- |
| API unavailable | Check /health, container/service logs, database reachability, and recent deploys. | Do not restart MongoDB or restore data as a first response. |
| Kitchen updates missing | Check socket state, station filter, ticket query, and order timeline. | Do not duplicate the order before confirming creation. |
| Payment ambiguous | Look up payment/order state and Razorpay provider reference; preserve request ID. | Do not collect a second payment blindly. |
| Unauthorized/forbidden | Confirm account role, active status, and explicit permission. | Do not work around it with a shared supervisor account. |
| Suspected secret exposure | Revoke/rotate affected secret and preserve evidence. | Do not paste secrets into logs, tickets, or chat. |

Escalations should include timestamp in UTC, environment, account/role,
order/payment identifier as permitted, request ID, exact error code, and
relevant safe log excerpts. See [security](security.md) for incident response
and [backup and restore](backup-restore.md) for data recovery.
