/// <reference path="../pb_data/types.d.ts" />

// Single-row counter for shortId allocation. The create hook previously
// computed SELECT MAX(shortId) + 1, which raced under concurrent quote
// creates (duplicate shortIds failing the unique index). An atomic
// UPDATE ... RETURNING on this row is serialized by SQLite instead.
migrate(
  (app) => {
    app
      .db()
      .newQuery(
        "CREATE TABLE IF NOT EXISTS shortid_counter (id INTEGER PRIMARY KEY CHECK (id = 1), value INTEGER NOT NULL)",
      )
      .execute();
    // Seed with the current max so existing data keeps its sequence.
    app
      .db()
      .newQuery(
        "INSERT OR IGNORE INTO shortid_counter (id, value) VALUES (1, COALESCE((SELECT MAX(shortId) FROM quotes), 0))",
      )
      .execute();
  },
  (app) => {
    app.db().newQuery("DROP TABLE IF EXISTS shortid_counter").execute();
  },
);
