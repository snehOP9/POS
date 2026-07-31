# Development sample credentials

These credentials exist only after running the API seed command against a
local/disposable database:

~~~powershell
npm run seed
~~~

| Role | Email | Password | Intended route |
| --- | --- | --- | --- |
| Cashier | cashier@ember.local | `SEED_DEMO_PASSWORD` (default: `demo-password`) | /cashier |
| Waiter | waiter@ember.local | `SEED_DEMO_PASSWORD` (default: `demo-password`) | /waiter |
| Kitchen | kitchen@ember.local | `SEED_DEMO_PASSWORD` (default: `demo-password`) | /kitchen |
| Customer | guest@ember.local | `SEED_DEMO_PASSWORD` (default: `demo-password`) | /menu |

These are public development fixtures, not secrets. The seed script must never
run automatically in staging or production, and production must not contain
known/demo credentials. Change or remove test users before sharing a preview
environment. Use separate Razorpay test keys for development and never embed
the provider key secret in browser code.
