{ self }:
let
  common =
    { pkgs, ... }:
    {
      imports = [ self.nixosModules.default ];
      environment.systemPackages = [ pkgs.curl ];
      virtualisation.memorySize = 768;
    };
in
{
  name = "miniqdb";

  nodes = {
    # Non-default bind address and port, firewall opened, and config.json
    # values from both `environment` and `environmentFile`.
    open =
      { pkgs, ... }:
      {
        imports = [ common ];
        services.miniqdb = {
          enable = true;
          host = "0.0.0.0";
          port = 8123;
          openFirewall = true;
          environment = {
            APP_NAME = ''Quotes "R" Us \o/'';
            NOTHING_TO_SEE_HERE_BUTTON_TEXT = ''C:\temp'';
          };
          # A store path is fine for the test; real deployments keep it out.
          environmentFile = pkgs.writeText "miniqdb.env" ''
            LOGIN_BUTTON_TEXT='Let me "in"'
          '';
        };
      };

    # Default port and environment. Listens on all interfaces so that only
    # the firewall stands between it and the other node.
    closed = {
      imports = [ common ];
      services.miniqdb = {
        enable = true;
        host = "0.0.0.0";
      };
    };
  };

  testScript =
    { nodes, ... }:
    let
      pocketbase = "${nodes.closed.services.miniqdb.pocketbase}/bin/pocketbase";
    in
    ''
      import json

      def status(node, url, *args):
          extra = " ".join(args)
          return node.succeed(f"curl -s -o /dev/null -w '%{{http_code}}' {extra} {url}").strip()

      def get_json(node, url, *args):
          extra = " ".join(args)
          return json.loads(node.succeed(f"curl -sf {extra} {url}"))

      start_all()

      for node, port in ((open, 8123), (closed, 8090)):
          node.wait_for_unit("miniqdb.service")
          node.wait_for_open_port(port)

      local = "http://127.0.0.1:8090"

      with subtest("health endpoint answers"):
          assert status(closed, f"{local}/api/health") == "200"
          assert status(open, "http://127.0.0.1:8123/api/health") == "200"

      with subtest("SPA is served, with fallback for client-side routes"):
          index = closed.succeed(f"curl -sf {local}/")
          assert "<!doctype html" in index.lower(), index
          assert closed.succeed(f"curl -sf {local}/quote/42") == index
          # The fallback must not swallow the API.
          assert status(closed, f"{local}/api/does-not-exist") == "404"

      with subtest("config.json defaults"):
          assert get_json(closed, f"{local}/config.json") == {
              "appName": "miniqdb",
              "loginButtonText": "Login",
              "nothingToSeeHereButtonText": "",
              "pocketbaseUrl": "/",
          }

      with subtest("config.json from environment and environmentFile, escaped"):
          assert get_json(open, "http://127.0.0.1:8123/config.json") == {
              "appName": 'Quotes "R" Us \\o/',
              "loginButtonText": 'Let me "in"',
              "nothingToSeeHereButtonText": "C:\\temp",
              "pocketbaseUrl": "/",
          }

      with subtest("service runs as the static miniqdb user"):
          pid = closed.succeed("systemctl show -p MainPID --value miniqdb.service").strip()
          assert closed.succeed(f"ps -o user= -p {pid}").strip() == "miniqdb"
          uid = int(closed.succeed("id -u miniqdb"))
          assert 0 < uid < 1000, uid

      with subtest("data directory is owned by the service user"):
          closed.succeed("test -f /var/lib/miniqdb/data.db")
          owners = closed.succeed("stat -c %U:%G /var/lib/miniqdb /var/lib/miniqdb/data.db").split()
          assert owners == ["miniqdb:miniqdb"] * 2, owners

      closed.succeed(
          "runuser -u miniqdb -- ${pocketbase} superuser upsert"
          " admin@example.com test-password-123 --dir /var/lib/miniqdb"
      )
      token = get_json(
          closed,
          f"{local}/api/collections/_superusers/auth-with-password",
          "-X POST -H 'Content-Type: application/json'",
          """-d '{"identity": "admin@example.com", "password": "test-password-123"}'""",
      )["token"]
      auth = f"-H 'Authorization: {token}' -H 'Content-Type: application/json'"

      with subtest("migrations are applied and hooks run"):
          collections = get_json(closed, f"{local}/api/collections?perPage=200", auth)["items"]
          by_name = {c["name"]: c for c in collections}
          for name in ("users", "quotes", "votes", "webhooks"):
              assert name in by_name, f"missing collection {name}"
          assert "isAdmin" in [f["name"] for f in by_name["users"]["fields"]]

          quote = get_json(
              closed,
              f"{local}/api/collections/quotes/records",
              "-X POST",
              auth,
              """-d '{"text": "persist me", "author": "someone@example.com"}'""",
          )
          # shortId allocation and the author's automatic vote come from the hooks.
          assert quote["shortId"] == 1, quote
          stored = get_json(closed, f"{local}/api/collections/quotes/records/{quote['id']}", auth)
          assert stored["score"] == 1, stored

      with subtest("editing collections does not need a writable migrations dir"):
          assert status(
              closed,
              f"{local}/api/collections",
              "-X POST",
              auth,
              """-d '{"name": "scratch", "type": "base", "fields": [{"name": "note", "type": "text"}]}'""",
          ) == "200"

      with subtest("data persists across a restart"):
          closed.systemctl("stop miniqdb.service")
          # A static user exists while the unit is down; a DynamicUser would not.
          closed.succeed("getent passwd miniqdb")
          closed.systemctl("start miniqdb.service")
          closed.wait_for_unit("miniqdb.service")
          closed.wait_for_open_port(8090)
          records = get_json(closed, f"{local}/api/collections/quotes/records", auth)["items"]
          assert [r["text"] for r in records] == ["persist me"], records
          assert status(closed, f"{local}/api/collections/scratch", auth) == "200"

      with subtest("port option is honored"):
          open.fail("curl -sf --max-time 5 http://127.0.0.1:8090/api/health")

      with subtest("firewall opens only with openFirewall"):
          closed.succeed("curl -sf --max-time 10 http://open:8123/api/health")
          open.fail("curl -sf --connect-timeout 5 http://closed:8090/api/health")
    '';
}
