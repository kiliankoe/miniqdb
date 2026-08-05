/// <reference path="../pb_data/types.d.ts" />

// The default 7-day auth token meant frequent OTP re-logins, which made
// quick quote submissions tedious. Issue 180-day tokens instead; combined
// with the background authRefresh on app load, active users stay signed in
// indefinitely. Applies to newly issued tokens only.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.authToken.duration = 15552000; // 180 days
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.authToken.duration = 604800; // PocketBase default
    app.save(users);
  },
);
