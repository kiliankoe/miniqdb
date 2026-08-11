{
  description = "miniqdb development environment and mqdb CLI";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
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
    in
    (flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages.mqdb = mkMqdb pkgs;
        packages.default = mkMqdb pkgs;

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
    };
}
