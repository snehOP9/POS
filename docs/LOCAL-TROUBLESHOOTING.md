# Local troubleshooting

## MongoDB connection errors

If the API cannot connect to MongoDB, verify that MongoDB 7+ is running and that `.env` points to the expected local database. With Compose, start the database with:

```powershell
docker compose up mongo -d
```

## Port conflicts

The normal local ports are frontend `5173`, API `4000`, and MongoDB `27017`. Stop another process using a required port or adjust the local configuration before starting the stack.

## Seed data is missing

Run the seed command after dependencies are installed:

```powershell
npm ci
npm run seed
```

The seed accounts are disposable development accounts. Never reuse their credentials in a shared or production environment.

## Docker and native MongoDB conflict

The Compose MongoDB container maps port `27017`. If a native MongoDB service is already using that port, stop it before starting the full Compose stack, or use the documented native-database workflow instead.

## Verify a change before opening a PR

```powershell
npm run typecheck
npm run test
npm run build
```

Then check `GET /health` and manually exercise the affected role flow.
