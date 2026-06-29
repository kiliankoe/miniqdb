{
  description = "miniqdb development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          # bun runs the frontend, the build, and scripts/migrate.ts (bun:sqlite).
          # PocketBase itself is included for running the backend locally without
          # Docker; `docker compose up pocketbase` remains the canonical path and
          # pins the exact version used in production.
          packages = [
            pkgs.bun
            pkgs.pocketbase
          ];

          shellHook = ''
            echo "miniqdb dev shell — bun $(bun --version), pocketbase $(pocketbase --version | head -n1)"
          '';
        };
      }
    );
}
