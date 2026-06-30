/// <reference path="../pb_data/types.d.ts" />

// Make votes.quote cascade on quote deletion. Previously the relation defaulted
// to RESTRICT, so deleting a quote with any votes failed with
// "the record is part of a required relation reference."
// Relation cascade lives on `field.cascadeDelete` (PocketBase 0.23+); the older
// `field.options.onDelete` shape no longer exists and throws on apply.
migrate(
  (app) => {
    const votes = app.findCollectionByNameOrId("votes");
    for (const field of votes.fields) {
      if (field.name === "quote") {
        field.cascadeDelete = true;
      }
    }
    app.save(votes);
  },
  (app) => {
    const votes = app.findCollectionByNameOrId("votes");
    for (const field of votes.fields) {
      if (field.name === "quote") {
        field.cascadeDelete = false; // RESTRICT (PocketBase default)
      }
    }
    app.save(votes);
  },
);
