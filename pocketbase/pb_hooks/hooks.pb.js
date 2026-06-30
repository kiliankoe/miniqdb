/// <reference path="../pb_data/types.d.ts" />

// Note: PocketBase JSVM doesn't share module-scope helper functions across
// hook callbacks — each callback is isolated. Inline any shared logic.

// ---------------------------------------------------------------------------
// a) Auto-increment shortId on quote creation (idempotent — skips if caller
//    already set a non-zero shortId, e.g. during data migration)
// ---------------------------------------------------------------------------
onRecordCreate((e) => {
  // Default created/updated for app-submitted quotes. The migration provides
  // historical timestamps, which are left untouched (these are plain date
  // fields, not autodate, so the values aren't overwritten).
  const nowIso = new Date().toISOString();
  if (!e.record.getString("created")) {
    e.record.set("created", nowIso);
  }
  if (!e.record.getString("updated")) {
    e.record.set("updated", nowIso);
  }

  if (e.record.getInt("shortId") > 0) {
    e.next();
    return;
  }

  let maxShortId = 0;

  try {
    const latest = e.app.findRecordsByFilter(
      "quotes",
      "id != ''",
      "-shortId",
      1,
      0
    );
    if (latest && latest.length > 0) {
      maxShortId = latest[0].getInt("shortId");
    }
  } catch (_) {
    // No quotes exist yet, start at 1.
  }

  e.record.set("shortId", maxShortId + 1);

  e.next();
}, "quotes");

// Keep `updated` current on quote edits (plain date field, so not automatic).
onRecordUpdate((e) => {
  e.record.set("updated", new Date().toISOString());
  e.next();
}, "quotes");

// Reject vote values outside {-1, 1}. The schema only enforces "required
// number", so without this a direct API call could submit arbitrary values
// and distort the denormalized score. Vote removal happens via record
// deletion, not a 0-value record.
onRecordCreate((e) => {
  const value = e.record.getInt("value");
  if (value !== 1 && value !== -1) {
    throw new BadRequestError("Vote value must be 1 or -1.");
  }
  e.next();
}, "votes");

onRecordUpdate((e) => {
  const value = e.record.getInt("value");
  if (value !== 1 && value !== -1) {
    throw new BadRequestError("Vote value must be 1 or -1.");
  }
  e.next();
}, "votes");

// Default created/updated for new votes (app votes and the auto-vote hook).
// The migration provides historical timestamps, which are left untouched.
onRecordCreate((e) => {
  const nowIso = new Date().toISOString();
  if (!e.record.getString("created")) {
    e.record.set("created", nowIso);
  }
  if (!e.record.getString("updated")) {
    e.record.set("updated", nowIso);
  }
  e.next();
}, "votes");

// Keep `updated` current on vote changes (plain date field, so not automatic).
onRecordUpdate((e) => {
  e.record.set("updated", new Date().toISOString());
  e.next();
}, "votes");

// ---------------------------------------------------------------------------
// b) Auto-vote +1 for the quote author after quote creation (no-op if a vote
//    by that author already exists — happens during data migration)
// ---------------------------------------------------------------------------
onRecordAfterCreateSuccess((e) => {
  const author = e.record.getString("author");

  let existing = null;
  try {
    existing = e.app.findFirstRecordByFilter(
      "votes",
      `quote = "${e.record.id}" && author = "${author}"`
    );
  } catch (_) {
    // No existing vote.
  }

  if (!existing) {
    const votesCollection = e.app.findCollectionByNameOrId("votes");
    const vote = new Record(votesCollection, {
      quote: e.record.id,
      author: author,
      value: 1,
    });
    e.app.save(vote);
  }

  e.next();
}, "quotes");

// ---------------------------------------------------------------------------
// c) Score denormalization: recalculate quote score on vote changes
// ---------------------------------------------------------------------------
onRecordAfterCreateSuccess((e) => {
  const quoteId = e.record.getString("quote");
  let totalScore = 0;
  try {
    const votes = e.app.findRecordsByFilter("votes", `quote = "${quoteId}"`, "", 0, 0);
    for (const vote of votes) {
      totalScore += vote.getInt("value");
    }
  } catch (_) {}
  try {
    const quote = e.app.findRecordById("quotes", quoteId);
    quote.set("score", totalScore);
    e.app.save(quote);
  } catch (_) {}
  e.next();
}, "votes");

onRecordAfterUpdateSuccess((e) => {
  const quoteId = e.record.getString("quote");
  let totalScore = 0;
  try {
    const votes = e.app.findRecordsByFilter("votes", `quote = "${quoteId}"`, "", 0, 0);
    for (const vote of votes) {
      totalScore += vote.getInt("value");
    }
  } catch (_) {}
  try {
    const quote = e.app.findRecordById("quotes", quoteId);
    quote.set("score", totalScore);
    e.app.save(quote);
  } catch (_) {}
  e.next();
}, "votes");

onRecordAfterDeleteSuccess((e) => {
  const quoteId = e.record.getString("quote");
  let totalScore = 0;
  try {
    const votes = e.app.findRecordsByFilter("votes", `quote = "${quoteId}"`, "", 0, 0);
    for (const vote of votes) {
      totalScore += vote.getInt("value");
    }
  } catch (_) {}
  try {
    const quote = e.app.findRecordById("quotes", quoteId);
    quote.set("score", totalScore);
    e.app.save(quote);
  } catch (_) {}
  e.next();
}, "votes");

// ---------------------------------------------------------------------------
// d) Webhook triggers on quote creation
// ---------------------------------------------------------------------------
onRecordAfterCreateSuccess((e) => {
  let webhooks = [];

  try {
    webhooks = e.app.findRecordsByFilter("webhooks", "active = true", "", 0, 0);
  } catch (_) {
    // No webhooks configured.
    e.next();
    return;
  }

  const quoteShortId = e.record.getInt("shortId");
  const appName = $os.getenv("APP_NAME") || "miniqdb";
  const baseUrl = $os.getenv("BASE_URL") || "";
  // Match the original notification format: app name + a "Quote #N" link, no
  // quote text or author.
  const quoteLink = baseUrl
    ? `<${baseUrl}/${quoteShortId}|Quote #${quoteShortId}>`
    : `Quote #${quoteShortId}`;

  for (const webhook of webhooks) {
    const url = webhook.getString("url");

    try {
      if (url.indexOf("hooks.slack.com") !== -1) {
        // Slack block format
        $http.send({
          url: url,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `New ${appName} quote added.`,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `New ${appName} quote added.`,
                },
              },
              {
                type: "context",
                elements: [
                  {
                    type: "mrkdwn",
                    text: quoteLink,
                  },
                ],
              },
            ],
          }),
        });
      } else {
        // Generic JSON format
        $http.send({
          url: url,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "quote.created",
            quote: {
              id: quoteShortId,
              createdAt: e.record.getString("created"),
            },
          }),
        });
      }
    } catch (err) {
      console.log(`Failed to send webhook to ${url}: ${err}`);
    }
  }

  e.next();
}, "quotes");

// ---------------------------------------------------------------------------
// e) Auto-create user on OTP request if they don't exist
// ---------------------------------------------------------------------------
onRecordRequestOTPRequest((e) => {
  if (!e.record) {
    const email = e.requestInfo().body["email"];
    const record = new Record(e.collection);
    record.setEmail(email);
    record.setPassword($security.randomString(30));
    e.app.save(record);
    e.record = record;
  }
  return e.next();
}, "users");

// ---------------------------------------------------------------------------
// f) Email domain validation on user creation
// ---------------------------------------------------------------------------
onRecordCreate((e) => {
  const email = e.record.getString("email");

  if (!email) {
    throw new BadRequestError("Email is required.");
  }

  const domain = email.split("@")[1];

  if (!domain) {
    throw new BadRequestError("Invalid email address.");
  }

  const envDomains = $os.getenv("ALLOWED_DOMAINS");
  const allowedDomainsRaw = envDomains || "";

  if (!allowedDomainsRaw) {
    // No domain restrictions configured, allow all.
    e.next();
    return;
  }

  const allowedDomains = allowedDomainsRaw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0);

  if (allowedDomains.length === 0) {
    e.next();
    return;
  }

  if (allowedDomains.indexOf(domain.toLowerCase()) === -1) {
    // Keep this generic — don't disclose the rejected domain or the allowlist.
    throw new BadRequestError("Registration is not allowed for this email address.");
  }

  e.next();
}, "users");

// ---------------------------------------------------------------------------
// g) Admins from the ADMIN_EMAILS env var (comma-separated list).
//    When set, ADMIN_EMAILS is authoritative: listed users are admins and
//    everyone else is not. When unset/empty, isAdmin is left untouched so it
//    can still be managed manually via the admin UI.
// ---------------------------------------------------------------------------

// On user creation: promote immediately if listed (no restart needed for a
// freshly-registered admin).
onRecordCreate((e) => {
  const adminEmails = ($os.getenv("ADMIN_EMAILS") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  if (adminEmails.length > 0) {
    const email = e.record.getString("email").toLowerCase();
    if (adminEmails.indexOf(email) !== -1) {
      e.record.set("isAdmin", true);
    }
  }

  e.next();
}, "users");

// On startup: reconcile existing users against ADMIN_EMAILS.
onBootstrap((e) => {
  // Finish bootstrap first so migrations have run and the DB is queryable.
  e.next();

  const raw = $os.getenv("ADMIN_EMAILS");
  if (!raw) {
    // No declarative config; leave manual admin assignments alone.
    return;
  }

  const adminEmails = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  let users = [];
  try {
    users = e.app.findRecordsByFilter("users", "id != ''", "", 0, 0);
  } catch (_) {
    return;
  }

  for (const user of users) {
    const shouldBeAdmin =
      adminEmails.indexOf(user.getString("email").toLowerCase()) !== -1;
    if (user.getBool("isAdmin") !== shouldBeAdmin) {
      user.set("isAdmin", shouldBeAdmin);
      e.app.save(user);
    }
  }
});

// ---------------------------------------------------------------------------
// h) Application + SMTP configuration from env vars.
//    PocketBase normally stores these in the admin UI (pb_data). For a
//    declarative deployment, configure them from the environment instead:
//    - APP_NAME sets the application name (used in the OTP email subject,
//      "OTP for <APP_NAME>"); defaults to "miniqdb" so it never falls back to
//      PocketBase's "Acme" default.
//    - when SMTP_HOST is set, mail is enabled and configured on startup;
//      when unset, the existing mail settings are left untouched.
// ---------------------------------------------------------------------------
onBootstrap((e) => {
  // Finish bootstrap first so settings are loaded.
  e.next();

  try {
    const settings = e.app.settings();

    settings.meta.appName = $os.getenv("APP_NAME") || "miniqdb";

    const host = $os.getenv("SMTP_HOST");
    if (host) {
      settings.smtp.enabled = true;
      settings.smtp.host = host;
      settings.smtp.port = parseInt($os.getenv("SMTP_PORT") || "587", 10);
      settings.smtp.username = $os.getenv("SMTP_USERNAME") || "";
      settings.smtp.password = $os.getenv("SMTP_PASSWORD") || "";
      // TLS=false uses StartTLS (port 587); set SMTP_TLS=true for implicit
      // TLS (port 465).
      settings.smtp.tls = ($os.getenv("SMTP_TLS") || "false").toLowerCase() === "true";

      const senderAddress = $os.getenv("SMTP_SENDER_ADDRESS");
      if (senderAddress) {
        settings.meta.senderAddress = senderAddress;
      }
      const senderName = $os.getenv("SMTP_SENDER_NAME");
      if (senderName) {
        settings.meta.senderName = senderName;
      }
    }

    e.app.save(settings);
  } catch (err) {
    console.log(`Failed to apply settings from env: ${err}`);
  }
});
