/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // -----------------------------------------------------------------------
    // Enable OTP auth on the built-in users collection
    // -----------------------------------------------------------------------
    const users = app.findCollectionByNameOrId("users");
    users.otp.enabled = true;
    users.otp.duration = 300; // 5 minutes
    users.otp.length = 6;
    // Add isAdmin field for admin role
    users.fields.add(
      new Field({ name: "isAdmin", type: "bool" }),
    );
    // Lock the users collection down. Registration happens via the
    // onRecordRequestOTPRequest hook (which bypasses createRule via app.save),
    // and self-updates are disallowed to prevent isAdmin self-escalation.
    users.listRule = null;
    users.viewRule = "id = @request.auth.id";
    users.createRule = null;
    users.updateRule = null;
    users.deleteRule = null;
    app.save(users);

    // -----------------------------------------------------------------------
    // quotes collection
    // -----------------------------------------------------------------------
    const quotes = new Collection({
      name: "quotes",
      type: "base",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && author = @request.auth.email",
      updateRule: "@request.auth.isAdmin = true || author = @request.auth.email",
      deleteRule: "@request.auth.isAdmin = true || author = @request.auth.email",
      fields: [
        { name: "text", type: "text", required: true },
        { name: "author", type: "text", required: true },
        { name: "shortId", type: "number", required: true },
        { name: "score", type: "number" },
        // Plain date (not autodate) so the migration can preserve original
        // timestamps; the shortId hook defaults them to now for new quotes.
        { name: "created", type: "date" },
        { name: "updated", type: "date" },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_quotes_shortId ON quotes (shortId)",
      ],
    });
    app.save(quotes);

    // -----------------------------------------------------------------------
    // votes collection (created after quotes so the relation target exists)
    // -----------------------------------------------------------------------
    const savedQuotes = app.findCollectionByNameOrId("quotes");

    const votes = new Collection({
      name: "votes",
      type: "base",
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && author = @request.auth.email",
      updateRule: "@request.auth.id != '' && author = @request.auth.email",
      deleteRule: "@request.auth.id != '' && author = @request.auth.email",
      fields: [
        {
          name: "quote",
          type: "relation",
          required: true,
          collectionId: savedQuotes.id,
          maxSelect: 1,
        },
        { name: "author", type: "text", required: true },
        { name: "value", type: "number", required: true },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_votes_quote_author ON votes (quote, author)",
      ],
    });
    app.save(votes);

    // -----------------------------------------------------------------------
    // webhooks collection (admin only)
    // -----------------------------------------------------------------------
    const webhooks = new Collection({
      name: "webhooks",
      type: "base",
      listRule: "@request.auth.isAdmin = true",
      viewRule: "@request.auth.isAdmin = true",
      createRule: "@request.auth.isAdmin = true",
      updateRule: "@request.auth.isAdmin = true",
      deleteRule: "@request.auth.isAdmin = true",
      fields: [
        { name: "url", type: "url", required: true },
        { name: "active", type: "bool" },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    });
    app.save(webhooks);
  },
  (app) => {
    // down — remove in reverse order to avoid relation constraint issues
    try {
      const webhooks = app.findCollectionByNameOrId("webhooks");
      app.delete(webhooks);
    } catch (_) {}

    try {
      const votes = app.findCollectionByNameOrId("votes");
      app.delete(votes);
    } catch (_) {}

    try {
      const quotes = app.findCollectionByNameOrId("quotes");
      app.delete(quotes);
    } catch (_) {}
  }
);
