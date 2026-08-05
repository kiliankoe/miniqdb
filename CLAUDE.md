# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

miniqdb is a minimalistic quote database web application for private communities. It uses a Vite + React frontend with PocketBase as the backend, deployed via docker-compose.

## Essential Commands

### Development
- `bun run dev` - Start Vite dev server (frontend only, proxy to PocketBase at localhost:8090)
- `bun run build` - Type-check and build production bundle
- `bun run preview` - Preview production build locally
- `bun run lint` - Run Biome linter
- `bun run format` - Format code with Biome

### Testing
- `bun run test` - Run frontend unit tests (Vitest, jsdom)
- `bun run test:integration` - Run PocketBase hook integration tests (boots an ephemeral PocketBase binary against the real hooks/migrations; downloads the pinned binary to `.pb-test/` on first run)
- `bun run test:all` - Run both projects

### Docker
- `docker compose up` - Start both frontend and PocketBase
- `docker compose up pocketbase` - Start PocketBase only (for dev with Vite)

### Migration
- `bun scripts/migrate.ts <sqlite-db-path> <pocketbase-url>` - Migrate data from old SQLite DB to PocketBase

### API Tokens
- `bun scripts/mint-token.ts <pocketbase-url> <user-email> [duration-days]` - Mint a long-lived impersonation token for scripted quote submission (needs `PB_ADMIN_EMAIL`/`PB_ADMIN_PASSWORD`)

### CLI (cli/)
- `cargo test` (in `cli/`) - Unit tests + integration tests booting a real PocketBase (shares the `.pb-test/` binary cache with the vitest integration tests)
- `cargo clippy --all-targets -- -D warnings` / `cargo fmt` - Lint/format (CI enforces both)
- `nix build .#mqdb` - Build the CLI via the flake (requires `cli/` to be git-tracked and `Cargo.lock` committed)

## Architecture Overview

### Tech Stack
- **Frontend**: Vite + React 19 + TypeScript
- **Routing**: @tanstack/react-router (file-based routing)
- **Data Fetching**: @tanstack/react-query + PocketBase JS SDK
- **Backend**: PocketBase (REST API, auth, realtime)
- **UI**: Material-UI (MUI)
- **Auth**: PocketBase OTP (email code, no passwords)
- **Deployment**: docker-compose (nginx frontend + PocketBase)

### Project Structure
- `/src/routes/` - TanStack Router file-based routes
  - `__root.tsx` - Root layout (MUI theme, CssBaseline)
  - `_authenticated.tsx` - Auth guard layout + realtime subscriptions
  - `_authenticated/` - Protected pages (home, search, submit, admin, quote detail)
  - `login.tsx` - Login page with OTP flow
- `/src/components/` - React components (QuoteView, VoteView, Header, Navigation, etc.)
- `/src/lib/` - Shared logic
  - `pocketbase.ts` - PocketBase client singleton
  - `queries.ts` - React Query hooks for all API operations
  - `realtime.ts` - PocketBase realtime subscriptions
  - `config.ts` - Runtime config loader
  - `types.ts` - Shared TypeScript types
- `/src/hooks/` - Custom React hooks
- `/pocketbase/` - PocketBase server config
  - `pb_hooks/` - Server-side JS hooks (score denorm, shortId, webhooks, domain validation)
  - `pb_migrations/` - Collection schema migrations
- `/cli/` - `mqdb`, a Rust CLI/TUI companion (clap + ureq + ratatui)
  - `src/api.rs` - PocketBase API client mirroring `src/lib/queries.ts` semantics
  - `src/commands/` - `login` (OTP or `--token`), `list`, `submit`, `search`
  - `src/tui/` - full-screen TUI (worker thread + pure `App::update` state machine)
  - `tests/` - integration tests booting a real PocketBase (Rust port of `pb-harness.ts`)
  - Packaged via the flake as `packages.mqdb` / `overlays.default`

### Key Architectural Patterns
- **PocketBase as sole backend**: No custom API server. Frontend calls PocketBase REST API directly.
- **Auth via OTP**: Users log in with email code. Domain restriction enforced via PocketBase hooks. Auth tokens last 180 days and are refreshed once per app load; superusers can mint long-lived impersonation tokens for scripted access (`scripts/mint-token.ts`).
- **Denormalized score**: Vote score stored on quote records, updated via PocketBase hooks on vote changes.
- **Per-user vote**: Fetched client-side as a second query, merged in react-query layer.
- **Realtime**: PocketBase subscriptions update react-query cache for live score/quote updates.
- **Runtime config**: `/config.json` generated at container start from env vars (no build-time env).
- **Path imports**: `@/` prefix maps to `src/`

### Data Model (PocketBase Collections)
- **quotes**: text, author (email), shortId (unique int), score (denormalized)
- **votes**: quote (relation), author (email), value (+1/-1), unique on (quote, author)
- **webhooks**: url, active (bool)
- **users**: PocketBase auth collection with isAdmin field

### Environment Configuration (docker-compose)
- `APP_NAME` - Application name (default: miniqdb)
- `LOGIN_BUTTON_TEXT` - Login button label (default: Login)
- `NOTHING_TO_SEE_HERE_BUTTON_TEXT` - Easter egg button (default: empty/hidden)
- `ALLOWED_DOMAINS` - Comma-separated allowed email domains (on PocketBase service)
- `ADMIN_EMAILS` - Comma-separated admin emails (on PocketBase service); authoritative when set: reconciled on startup via `onBootstrap` and at user-create time in `hooks.pb.js`
- `SMTP_*` - `SMTP_HOST`/`SMTP_PORT`/`SMTP_USERNAME`/`SMTP_PASSWORD`/`SMTP_TLS`/`SMTP_SENDER_ADDRESS`/`SMTP_SENDER_NAME` (on PocketBase service); when `SMTP_HOST` is set, an `onBootstrap` hook configures mail on startup. Otherwise configure SMTP via the PocketBase admin UI.
- `APP_NAME` / `BASE_URL` - also read by the PocketBase new-quote webhook hook to render the Slack notification (`New <APP_NAME> quote added.` + a `Quote #N` link to `BASE_URL/<shortId>`)
