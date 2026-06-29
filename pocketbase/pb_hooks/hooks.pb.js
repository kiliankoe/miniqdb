/// <reference path="../pb_data/types.d.ts" />

// Note: PocketBase JSVM doesn't share module-scope helper functions across
// hook callbacks — each callback is isolated. Inline any shared logic.

// ---------------------------------------------------------------------------
// a) Auto-increment shortId on quote creation (idempotent — skips if caller
//    already set a non-zero shortId, e.g. during data migration)
// ---------------------------------------------------------------------------
onRecordCreate((e) => {
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

  const quoteText = e.record.getString("text");
  const quoteAuthor = e.record.getString("author");
  const quoteShortId = e.record.getInt("shortId");

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
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*New quote #${quoteShortId}*\n>${quoteText}\n_-- ${quoteAuthor}_`,
                },
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
            data: {
              id: e.record.id,
              shortId: quoteShortId,
              text: quoteText,
              author: quoteAuthor,
              score: e.record.getInt("score"),
              created: e.record.getString("created"),
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
    throw new BadRequestError(
      `Registration is not allowed for the domain "${domain}". Allowed domains: ${allowedDomains.join(", ")}`
    );
  }

  e.next();
}, "users");
