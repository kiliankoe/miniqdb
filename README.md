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
2. Configure SMTP (required for OTP login emails — without this, no login codes will be delivered), either under Settings > Mail in the admin UI, or declaratively via the `SMTP_*` environment variables (see the table below).

### Admin users

Regular users cannot flip their own `isAdmin` flag (the `users` collection is superuser-only for updates). There are two ways to grant admin:

**Via `ADMIN_EMAILS` (recommended).** Set `ADMIN_EMAILS` on the PocketBase service to a comma-separated list of emails. When set, it is authoritative: on startup every listed user is promoted to admin and every other user is demoted, and anyone who later registers with a listed email is promoted immediately (no restart needed). Leave it empty to manage `isAdmin` manually instead.

```bash
ADMIN_EMAILS=me@example.com,you@example.com docker compose up
```

**Via the admin UI.** With `ADMIN_EMAILS` unset, have the user register on `/login`, then in the PocketBase admin UI (`/_/`) open the `users` collection, edit the record, and set `isAdmin` to `true`. The user refreshes the app and the `#admin` nav link appears.

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
| `ADMIN_EMAILS`                    | _(none)_  | Comma-separated admin emails (authoritative when set) |
| `SMTP_HOST`                       | _(none)_  | SMTP server host; when set, mail is configured on startup |
| `SMTP_PORT`                       | `587`     | SMTP server port |
| `SMTP_USERNAME`                   | _(none)_  | SMTP auth username |
| `SMTP_PASSWORD`                   | _(none)_  | SMTP auth password |
| `SMTP_TLS`                        | `false`   | `true` for implicit TLS (port 465); `false` uses StartTLS (587) |
| `SMTP_SENDER_ADDRESS`             | _(none)_  | From address for OTP emails |
| `SMTP_SENDER_NAME`                | _(none)_  | From name for OTP emails |

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
