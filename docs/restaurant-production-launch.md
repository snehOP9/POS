# Restaurant production launch

The application can be deployed without these details, but it must not be presented as a live restaurant until the owner supplies and verifies them.

## Owner-supplied facts

- Publish the legal restaurant name, address, guest phone, guest email, opening hours, time zone, parking and accessibility information in Cashier > Settings.
- Turn on public contact only after the published phone and email are actively monitored.
- Replace every demo or licensed stock image with restaurant-owned, licensed photography. Record the source and owner for each menu and gallery image.
- Verify each menu item’s vegetarian status, allergens and spice level with the kitchen. Do not infer these fields from a recipe name or photo.
- Review the privacy notice with the actual restaurant legal entity, data-retention period, booking process and service providers.

## Reservation delivery

Reservation requests always create an in-app Cashier notification. To send guest acknowledgements and restaurant alerts by email, configure the following Render environment variables:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` — a verified sender on the restaurant domain
- `RESERVATION_NOTIFICATION_EMAIL` — the inbox monitored by the reservations team

Before enabling delivery, authenticate the sending domain with SPF, DKIM and DMARC in the email provider. Submit one test request, confirm delivery to both guest and team inboxes, then confirm the cashier can accept or decline it without creating a duplicate email.

## Payments and ordering

- Add real Razorpay production credentials and configure the signed webhook before presenting online payment as available.
- Test payment success, payment failure, duplicate webhook delivery, refund, receipt, kitchen handoff and order completion using provider test mode first.
- Keep table ordering behind valid QR/table context and verify a guest cannot use another table’s link.

## Domain, search and operations

- Add a restaurant-owned domain in Vercel, point DNS, and then replace the `vercel.app` URLs in `frontend/public/robots.txt`, `frontend/public/sitemap.xml`, `render.yaml` and production environment variables.
- Verify the canonical URL, Open Graph card and structured data after DNS is live.
- The `Production health` GitHub Actions workflow checks the public site, API readiness and menu endpoint every ten minutes. Enable repository workflow-failure notifications for the owner/on-call operator.
- Confirm database backup/restore policy with the Atlas plan before taking real reservations or orders. The current low-cost staging setup is not a substitute for a tested recovery plan.
