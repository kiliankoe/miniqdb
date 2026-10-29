{
  description = "miniqdb development environment and mqdb CLI";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    # bun.nix has no stable schema across bun2nix versions, so this tag moves
    # together with the bun2nix devDependency in package.json.
    bun2nix = {
      url = "github:nix-community/bun2nix/2.1.2";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      bun2nix,
      ...
    }:
    let
      # Shared between the per-system package and the overlay.
      mkMqdb =
        pkgs:
        pkgs.rustPlatform.buildRustPackage {
          pname = "mqdb";
          version = (fromTOML (builtins.readFile ./cli/Cargo.toml)).package.version;
          src = ./cli;
          cargoLock.lockFile = ./cli/Cargo.lock;
          # The crate's integration tests boot a real PocketBase (downloaded
          # binary + network), which the sandbox forbids; they run via
          # `cargo test` locally and in CI instead.
          doCheck = false;
          meta.mainProgram = "mqdb";
        };

      # The Docker image's PB_VERSION stays the one place the version is set;
      # bumping it fails this build until both hashes below follow, which
      # scripts/update-pocketbase.sh recomputes.
      pocketbaseVersion = builtins.head (
        builtins.match ".*ARG PB_VERSION=([^[:space:]]+).*" (builtins.readFile ./pocketbase/Dockerfile)
      );
      mkPocketbase =
        pkgs:
        # 0.40 needs Go 1.27, which is why nixpkgs' own pocketbase stays on 0.39.
        (pkgs.pocketbase.override { buildGoModule = pkgs.buildGo127Module; }).overrideAttrs (
          finalAttrs: _: {
            version = pocketbaseVersion;
            src = pkgs.fetchFromGitHub {
              owner = "pocketbase";
              repo = "pocketbase";
              rev = "v${finalAttrs.version}";
              hash = "sha256-vI8uIWRsivOBKV5x0435w+EBUvXjyXFf0M657ErE/Os=";
            };
            vendorHash = "sha256-LRjHwlGQrcY0ZJdv04ZqV/Adl7N5Us9lvlNb7YSmMdg=";
          }
        );
    in
    (flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages.mqdb = mkMqdb pkgs;
        packages.default = mkMqdb pkgs;
        packages.frontend = pkgs.callPackage ./nix/frontend.nix {
          bun2nix = bun2nix.packages.${system}.default;
        };
        packages.pocketbase = mkPocketbase pkgs;

        checks = pkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
          nixos-module = pkgs.testers.runNixOSTest (import ./nixos-test.nix { inherit self; });
        };

        devShells.default = pkgs.mkShell {
          # bun runs the frontend, the build, and scripts/migrate.ts (bun:sqlite).
          # PocketBase itself is included for running the backend locally without
          # Docker; `docker compose up pocketbase` remains the canonical path and
          # pins the exact version used in production.
          # The Rust toolchain builds the mqdb CLI in cli/.
          packages = [
            pkgs.bun
            pkgs.pocketbase
            pkgs.cargo
            pkgs.rustc
            pkgs.rust-analyzer
            pkgs.clippy
            pkgs.rustfmt
          ];

          shellHook = ''
            echo "miniqdb dev shell — bun $(bun --version), pocketbase $(pocketbase --version | head -n1), cargo $(cargo --version | cut -d' ' -f2)"
          '';
        };
      }
    ))
    // {
      overlays.default = final: _prev: { mqdb = mkMqdb final; };
      nixosModules.default = import ./nix/module.nix self;
    };
}
