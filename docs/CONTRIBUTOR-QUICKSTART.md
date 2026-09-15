# Contributor Quickstart

This guide is a short path from cloning the repository to validating a change.

## Setup

1. Install Node.js 20.19+ and npm 10+.
2. Copy `.env.example` to `.env`.
3. Start MongoDB locally or with Docker Compose.
4. Run `npm ci`.
5. Run `npm run seed` for disposable development data.
6. Run `npm run dev`.

The frontend is normally available on port 5173 and the API on port 4000.

## Make a focused change

Keep UI changes in the relevant frontend area and API/domain changes in the backend workspace. Shared request and response contracts belong in `packages/shared/` when both sides need them.

## Verify

Run the smallest relevant checks while developing, then run the complete set before opening a PR:

```text
npm run typecheck
npm run test
npm run build
```

For role-specific changes, manually verify the affected cashier, waiter, kitchen, or customer flow.

## Security

Never commit `.env` files, real credentials, production database URLs, payment secrets, or tokens. Use the documented disposable seed accounts only for local development.