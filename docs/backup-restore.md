# Backup and restore runbook

## Policy

Back up all MongoDB data that supports restaurant operation: configuration,
menu/catalogue, tables, accounts, orders, payments and provider references,
kitchen tickets, shifts, notifications, and audit records. Historical payments
and audit data must be retained/archived according to the restaurant's legal
and accounting requirements; cleanup must not silently delete them.

Suggested baseline: daily encrypted full backup, point-in-time recovery or
hourly incremental capability where available, 30 days of daily retention, 12
monthly restore points, and a verified restore at least quarterly. Choose the
actual retention/RPO/RTO with the restaurant operator and any applicable
financial record-keeping obligations.

## Before a release or risky data operation

1. Confirm database health and free storage.
2. Create an encrypted backup and capture the timestamp, deployment version,
   backup location, and checksum.
3. Verify it is readable and protected by least-privilege access.
4. Do not proceed until a restore owner and rollback decision path are known.

## Self-hosted MongoDB example

Run from a secured administration host, not an application container. Put the
URI in a protected shell secret or secret manager, never a command history.

~~~powershell
mongodump --uri "$env:MONGODB_URI" --archive=emberserve-utc.archive --gzip
Get-FileHash .\emberserve-utc.archive -Algorithm SHA256
~~~

Encrypt the archive before transfer and place it in access-controlled,
versioned off-site storage. For MongoDB Atlas, configure continuous/cloud
backups and export/restore through the Atlas-supported process instead of
copying database files.

## Restore procedure

1. Declare an incident and stop or maintenance-gate writes to avoid losing
   newly created orders/payments.
2. Identify the target timestamp and obtain approval from the accountable
   operator. Preserve the current database first; it may contain records
   created after the chosen restore point.
3. Restore into an isolated database or staging cluster first:

~~~powershell
mongorestore --uri "$env:RESTORE_MONGODB_URI" --archive=emberserve-utc.archive --gzip --nsFrom="emberserve.*" --nsTo="emberserve_restore.*"
~~~

4. Validate document counts, indexes, restaurant configuration, current menu,
   sample order totals, payment provider references, audit history, and API
   health against the restored copy.
5. Reconcile payment/refund activity with Razorpay before switching any
   customer-facing traffic. A database restore never replaces provider truth.
6. With explicit approval, perform the production restore using the approved
   namespace/database plan, redeploy compatible application code, and run the
   smoke checks.
7. Record the incident, restore point, records reconciled, residual gap, and
   follow-up actions.

Do not run destructive restore flags against production until the resolved
target database, backup timestamp, and rollback backup have been independently
checked.

## Restore drill checklist

- Restore to an isolated environment at least quarterly.
- Verify login with non-production credentials, public menu, tables, a
  historical completed order, a payment reference, audit log, and indexes.
- Measure recovery time and compare it to the agreed RTO.
- Confirm backup encryption, checksum, and access control remain valid.
- Update this runbook after each drill or significant schema/deployment change.
