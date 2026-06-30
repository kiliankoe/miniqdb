/// <reference path="../pb_data/types.d.ts" />

// Make votes.quote cascade on quote deletion. Previously the relation defaulted
// to RESTRICT, so deleting a quote with any votes failed with
// "the record is part of a required relation reference."
migrate(
  (app) => {
    const votes = app.findCollectionByNameOrId("votes");
    for (const field of votes.fields) {
      if (field.name === "quote") {
        field.options.onDelete = "cascade";
      }
    }
    app.save(votes);
  },
  (app) => {
    const votes = app.findCollectionByNameOrId("votes");
    for (const field of votes.fields) {
      if (field.name === "quote") {
        field.options.onDelete = ""; // RESTRICT (PocketBase default)
      }
    }
    app.save(votes);
  },
);
