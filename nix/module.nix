self:
{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.services.miniqdb;
  packages = self.packages.${pkgs.stdenv.hostPlatform.system};
  stateDir = "/var/lib/miniqdb";
  publicDir = "/run/miniqdb/public";

  # The frontend reads its settings from /config.json at runtime, so one build
  # serves every instance. Generated at start rather than at build time because
  # the values may come from environmentFile.
  preparePublicDir = pkgs.writeShellScript "miniqdb-prepare-public" ''
    set -eu
    rm -rf ${publicDir}
    mkdir -p ${publicDir}
    # A copy rather than symlinks: PocketBase sends the file's mtime as
    # Last-Modified, and store files all date from 1970, so browsers would
    # keep a stale index.html across upgrades.
    cp -r --no-preserve=mode,ownership ${cfg.package}/. ${publicDir}/
    ${lib.getExe pkgs.jq} -n \
      --arg appName "''${APP_NAME:-miniqdb}" \
      --arg loginButtonText "''${LOGIN_BUTTON_TEXT:-Login}" \
      --arg nothingToSeeHereButtonText "''${NOTHING_TO_SEE_HERE_BUTTON_TEXT:-}" \
      '{$appName, $loginButtonText, $nothingToSeeHereButtonText, pocketbaseUrl: "/"}' \
      > ${publicDir}/config.json
  '';
in
{
  options.services.miniqdb = {
    enable = lib.mkEnableOption "miniqdb, a quote database";

    package = lib.mkOption {
      type = lib.types.package;
      default = packages.frontend;
      defaultText = lib.literalExpression "miniqdb.packages.\${system}.frontend";
      description = "The built frontend.";
    };

    pocketbase = lib.mkOption {
      type = lib.types.package;
      default = packages.pocketbase;
      defaultText = lib.literalExpression "miniqdb.packages.\${system}.pocketbase";
      description = ''
        The PocketBase server. Its version should match the one the migrations
        and hooks in this repository are written for.
      '';
    };

    host = lib.mkOption {
      type = lib.types.str;
      default = "127.0.0.1";
      description = "Address PocketBase listens on.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 8090;
      description = "Port PocketBase listens on.";
    };

    environment = lib.mkOption {
      type = lib.types.attrsOf lib.types.str;
      default = { };
      description = ''
        Environment variables for the frontend config (`APP_NAME`,
        `LOGIN_BUTTON_TEXT`, `NOTHING_TO_SEE_HERE_BUTTON_TEXT`) and the hooks
        (`ALLOWED_DOMAINS`, `ADMIN_EMAILS`, `APP_NAME`, `BASE_URL`, `SMTP_*`).
        These end up world-readable in the Nix store; use environmentFile for
        secrets.
      '';
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      description = "Environment file as defined in systemd.exec(5), with the same variables as `environment`.";
    };

    openFirewall = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Whether to open the firewall for the PocketBase port.";
    };
  };

  config = lib.mkIf cfg.enable {
    users.users.miniqdb = {
      isSystemUser = true;
      group = "miniqdb";
    };
    users.groups.miniqdb = { };

    systemd.services.miniqdb = {
      description = "miniqdb quote database";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];

      inherit (cfg) environment;

      serviceConfig = {
        ExecStartPre = preparePublicDir;
        ExecStart = lib.escapeShellArgs [
          (lib.getExe cfg.pocketbase)
          "serve"
          "--http=${cfg.host}:${toString cfg.port}"
          "--dir=${stateDir}"
          "--hooksDir=${../pocketbase/pb_hooks}"
          "--migrationsDir=${../pocketbase/pb_migrations}"
          "--publicDir=${publicDir}"
          # Automigrate writes a migration file for every collection edit in
          # the admin UI, which fails in the read-only store.
          "--automigrate=false"
        ];
        EnvironmentFile = lib.mkIf (cfg.environmentFile != null) cfg.environmentFile;
        User = "miniqdb";
        Group = "miniqdb";
        StateDirectory = "miniqdb";
        RuntimeDirectory = "miniqdb";
        WorkingDirectory = stateDir;
        Restart = "on-failure";

        NoNewPrivileges = true;
        PrivateTmp = true;
        ProtectSystem = "strict";
        ProtectHome = true;
      };
    };

    networking.firewall.allowedTCPPorts = lib.mkIf cfg.openFirewall [ cfg.port ];
  };
}
