# Folder Restructure Plan

## Goal

Use clear top-level application folders while preserving all runtime behavior.

## Target layout

```text
frontend/
  src/
    customer/
    cashier/
    waiter/
    kitchen/
    auth/
    shared/
      components/
      data/
      hooks/
      lib/
      store/
      types/
backend/
  src/
    config/
    domain/
    lib/
    middleware/
    models/
    routes/
    services/
    scripts/
```

## Steps

1. Stop the local dev process and move the existing applications into
   `frontend` and `backend`.
2. Group the frontend route pages by customer, cashier, waiter, kitchen, and
   authentication responsibilities; update lazy route imports.
3. Update workspace scripts, Dockerfiles, Compose configuration, docs, and
   lockfile references.
4. Reinstall workspace links, type-check, build, test, seed, and relaunch the
   local stack.
