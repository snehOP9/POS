# Critical user flows

## Customer pickup order

~~~text
Customer menu -> add/customize -> server quote -> create order
  -> Razorpay provider order -> server signature verification
  -> kitchen ticket + real-time updates -> ready -> pickup/complete
~~~

The API revalidates modifier rules, availability, price, and final paise total
before order/payment creation. A browser payment success is not sufficient:
the API verifies the provider response and processes duplicate webhooks
idempotently.

## Dine-in order

~~~text
Opaque table QR -> validate table context -> customer/waiter creates order
  -> order round sent to kitchen -> prepare/item ready -> waiter notification
  -> served -> cashier settlement -> completed
~~~

Only the relevant role/order/table rooms receive the event. A table QR grants
context, not authorization to view other customers or staff information.

## Waiter second round

~~~text
Open assigned table -> add draft items -> send
  -> kitchen ticket for newly sent items -> kitchen state updates
  -> add another draft round -> send only incremental unsent items
~~~

The client shows draft versus sent/preparing/ready items distinctly. The API
uses an order version/transition check so stale staff edits cannot silently
erase another round.

## Cancellation and refund

~~~text
Authorized cashier -> reason + eligibility check -> cancel request
  -> provider refund initiation if needed -> refund pending
  -> verified provider result/webhook -> refunded + audit event
~~~

The role, explicit permission, preparation state, payment state, and reason
must all be considered. The system does not infer a refund from a cancelled
browser UI state.

## Connection recovery

~~~text
Connected -> Reconnecting/Offline -> reconnect -> refetch authoritative state
  -> reconcile conflict -> replay only explicitly safe idempotent drafts
~~~

Payments, refunds, settlement, and provider verification are never replayed
from offline client state. Users receive a visible resolution path for any
action that cannot be safely reconciled automatically.
