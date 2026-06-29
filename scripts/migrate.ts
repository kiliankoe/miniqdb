/**
 * Migration script: SQLite (Prisma) -> PocketBase
 *
 * Usage:
 *   bun scripts/migrate.ts <sqlite-db-path> <pocketbase-url>
 *
 * Example:
 *   bun scripts/migrate.ts ./wbbash-backup.db http://localhost:8090
 *
 * Prerequisites:
 *   - PocketBase must be running with collections already created (via migrations)
 *   - Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars for superuser auth
 */

import { Database } from "bun:sqlite";
import PocketBase from "pocketbase";

const [, , dbPath, pbUrl] = process.argv;

if (!dbPath || !pbUrl) {
  console.error(
    "Usage: bun scripts/migrate.ts <sqlite-db-path> <pocketbase-url>",
  );
  process.exit(1);
}

const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables",
  );
  process.exit(1);
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

async function main() {
  const db = new Database(dbPath);
  const pb = new PocketBase(pbUrl);

  // Authenticate as admin
  await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log("Authenticated as admin");

  // --- Migrate Quotes ---
  const quotes = db
    .prepare("SELECT id, text, author, createdAt, updatedAt FROM Quote ORDER BY id")
    .all() as Array<{
    id: number;
    text: string | null;
    author: string;
    createdAt: number;
    updatedAt: number;
  }>;

  console.log(`Migrating ${quotes.length} quotes...`);

  // Map old quote ID -> new PocketBase record ID
  const quoteIdMap = new Map<number, string>();

  for (const quote of quotes) {
    const record = await pb.collection("quotes").create({
      text: quote.text ?? "",
      author: quote.author,
      shortId: quote.id,
      score: 0, // Will be recalculated after votes
      created: msToIso(quote.createdAt),
      updated: msToIso(quote.updatedAt),
    });
    quoteIdMap.set(quote.id, record.id);
  }
  console.log(`  Migrated ${quoteIdMap.size} quotes`);

  // --- Migrate Votes ---
  const votes = db
    .prepare("SELECT id, quoteId, value, author, createdAt FROM Vote ORDER BY id")
    .all() as Array<{
    id: number;
    quoteId: number;
    value: number;
    author: string;
    createdAt: number;
  }>;

  console.log(`Migrating ${votes.length} votes...`);

  let votesCreated = 0;
  let votesSkipped = 0;

  for (const vote of votes) {
    const pbQuoteId = quoteIdMap.get(vote.quoteId);
    if (!pbQuoteId) {
      console.warn(`  Skipping vote for unknown quote ${vote.quoteId}`);
      votesSkipped++;
      continue;
    }

    try {
      await pb.collection("votes").create({
        quote: pbQuoteId,
        author: vote.author,
        value: vote.value,
        created: msToIso(vote.createdAt),
      });
      votesCreated++;
    } catch (err) {
      // Likely a duplicate from the auto-vote hook (quote author's +1).
      // Update the existing record to match the historical value/timestamp.
      const existing = await pb
        .collection("votes")
        .getFirstListItem(
          `quote = "${pbQuoteId}" && author = "${vote.author.replace(/"/g, '\\"')}"`,
        )
        .catch(() => null);
      if (existing) {
        await pb.collection("votes").update(existing.id, {
          value: vote.value,
          created: msToIso(vote.createdAt),
        });
        votesCreated++;
      } else {
        console.warn(
          `  Failed to migrate vote id=${vote.id} (quote ${vote.quoteId}): ${err instanceof Error ? err.message : String(err)}`,
        );
        votesSkipped++;
      }
    }
  }
  console.log(`  Migrated ${votesCreated} votes, skipped ${votesSkipped}`);

  // --- Recalculate scores ---
  console.log("Recalculating quote scores...");

  const scoreCounts = db
    .prepare(
      "SELECT quoteId, COALESCE(SUM(value), 0) as score FROM Vote GROUP BY quoteId",
    )
    .all() as Array<{ quoteId: number; score: number }>;

  for (const { quoteId, score } of scoreCounts) {
    const pbQuoteId = quoteIdMap.get(quoteId);
    if (pbQuoteId) {
      await pb.collection("quotes").update(pbQuoteId, { score });
    }
  }
  console.log(`  Updated scores for ${scoreCounts.length} quotes`);

  // --- Migrate Webhooks ---
  const webhooks = db
    .prepare("SELECT id, url, active, createdAt, updatedAt FROM Webhook ORDER BY id")
    .all() as Array<{
    id: number;
    url: string;
    active: number;
    createdAt: number;
    updatedAt: number;
  }>;

  console.log(`Migrating ${webhooks.length} webhooks...`);

  for (const webhook of webhooks) {
    await pb.collection("webhooks").create({
      url: webhook.url,
      active: Boolean(webhook.active),
      created: msToIso(webhook.createdAt),
      updated: msToIso(webhook.updatedAt),
    });
  }
  console.log(`  Migrated ${webhooks.length} webhooks`);

  // --- Summary ---
  const maxShortId = Math.max(...quotes.map((q) => q.id));
  console.log("\n--- Migration Summary ---");
  console.log(`Quotes: ${quoteIdMap.size}`);
  console.log(`Votes: ${votesCreated}`);
  console.log(`Webhooks: ${webhooks.length}`);
  console.log(`Max shortId: ${maxShortId} (counter should be seeded to this)`);
  console.log(
    "\nDone! Users will need to re-register via OTP with the same email addresses.",
  );

  db.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
