/**
 * Mint a long-lived API token for a user via PocketBase impersonation.
 *
 * Usage:
 *   bun scripts/mint-token.ts <pocketbase-url> <user-email> [duration-days]
 *
 * Example:
 *   bun scripts/mint-token.ts https://quotes.example.com me@example.com 365
 *
 * Prerequisites:
 *   - Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars for superuser auth
 *
 * Notes:
 *   - Impersonation tokens are nonrenewable; mint a new one when it expires.
 *   - There is no per-token revocation: changing the user's password
 *     invalidates all of that user's tokens (including browser sessions).
 */

import PocketBase from "pocketbase";

const [, , pbUrl, userEmail, durationDaysArg] = process.argv;

if (!pbUrl || !userEmail) {
  console.error(
    "Usage: bun scripts/mint-token.ts <pocketbase-url> <user-email> [duration-days]",
  );
  process.exit(1);
}

const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "";

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables",
  );
  process.exit(1);
}

const durationDays = Number(durationDaysArg ?? "365");
if (!Number.isFinite(durationDays) || durationDays <= 0) {
  console.error(`Invalid duration-days: ${durationDaysArg}`);
  process.exit(1);
}

async function main() {
  const pb = new PocketBase(pbUrl);
  await pb
    .collection("_superusers")
    .authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  const user = await pb
    .collection("users")
    .getFirstListItem(`email = "${userEmail.replace(/"/g, '\\"')}"`);

  const durationSeconds = durationDays * 86400;
  const impersonated = await pb
    .collection("users")
    .impersonate(user.id, durationSeconds);

  const expires = new Date(Date.now() + durationSeconds * 1000);
  console.log(`Token for ${userEmail} (expires ${expires.toISOString()}):\n`);
  console.log(impersonated.authStore.token);
}

main().catch((err) => {
  console.error("Failed to mint token:", err);
  process.exit(1);
});
