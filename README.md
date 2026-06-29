# miniqdb

A minimalistic quote database, akin to bash qdb. Built for private communities, not the wider web.

## Getting Started

### Development

Start PocketBase via docker compose:

```bash
docker compose up pocketbase
```

This starts PocketBase on [http://localhost:8090](http://localhost:8090). On first run, visit the admin UI at [http://localhost:8090/\_/](http://localhost:8090/_/) to:

1. Create a superuser account.
2. Configure SMTP under Settings > Mail (required for OTP login emails — without this, no login codes will be delivered).

### Bootstrapping the first admin user

Regular users cannot flip their own `isAdmin` flag (the `users` collection is superuser-only for updates). To promote a user to admin:

1. Have the user register by entering their email on `/login` and verifying the OTP.
2. In the PocketBase admin UI (`/_/`), open the `users` collection, edit the user record, and set `isAdmin` to `true`.
3. The user refreshes the app; the `#admin` nav link appears.

Then start the frontend:

```bash
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` requests to PocketBase automatically.

### Production

```bash
docker compose up
```

This builds and starts both the frontend (nginx on port 80) and PocketBase (port 8090). Runtime config is injected via environment variables:

| Variable                          | Default   | Description                           |
| --------------------------------- | --------- | ------------------------------------- |
| `APP_NAME`                        | `miniqdb` | App name shown in the header          |
| `LOGIN_BUTTON_TEXT`               | `Login`   | Login button label                    |
| `NOTHING_TO_SEE_HERE_BUTTON_TEXT` | _(empty)_ | Easter egg button (hidden when empty) |
| `ALLOWED_DOMAINS`                 | _(none)_  | Comma-separated allowed email domains |

## Data Migration

To migrate from the old Next.js/Prisma/SQLite setup:

```bash
bun install
PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=secret \
  bun scripts/migrate.ts ./backup.db http://localhost:8090
```

## Scripts

| Command           | Description                         |
| ----------------- | ----------------------------------- |
| `bun run dev`     | Start Vite dev server               |
| `bun run build`   | Type-check and build for production |
| `bun run preview` | Preview production build            |
| `bun run lint`    | Lint with Biome                     |
| `bun run format`  | Format with Biome                   |
