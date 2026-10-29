#!/usr/bin/env bash
# Bumps the PocketBase pin (ARG PB_VERSION in pocketbase/Dockerfile) to the
# given version, or to the newest stable release, and recomputes the flake's
# source and vendor hashes to match. Needs nix, plus gh for the release lookup.
#
# usage: scripts/update-pocketbase.sh [version]
set -euo pipefail
cd "$(dirname "$0")/.."

dockerfile=pocketbase/Dockerfile
current=$(sed -n 's/^ARG PB_VERSION=//p' "$dockerfile")

# Sorted by version rather than taken from releases/latest, because the 0.22
# LTS line keeps publishing releases and could otherwise come out on top.
latest=${1:-$(gh api 'repos/pocketbase/pocketbase/releases?per_page=100' \
  --jq '.[] | select(.prerelease or .draft | not) | .tag_name | ltrimstr("v")' |
  sort -V | tail -n1)}

if [[ -n ${GITHUB_OUTPUT:-} ]]; then
  echo "from=$current" >>"$GITHUB_OUTPUT"
  echo "to=$latest" >>"$GITHUB_OUTPUT"
fi

if [[ ! $latest =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Not a release version: $latest" >&2
  exit 1
fi
# Never move backwards, e.g. off a release candidate pinned by hand.
if [[ $(printf '%s\n' "$current" "$latest" | sort -V | tail -n1) == "$current" ]]; then
  echo "PocketBase $current is not older than $latest"
  exit 0
fi
echo "Bumping PocketBase $current -> $latest"

# perl -i behaves the same on GNU and BSD, unlike sed -i.
perl -pi -e "s/^ARG PB_VERSION=.*/ARG PB_VERSION=$latest/" "$dockerfile"

# An empty hash makes nix fail the fixed-output build and report the real one.
# The source goes first since the vendored modules are derived from it.
update_hash() {
  local attr=$1 field=$2 log hash
  perl -pi -e "s|^(\s*$field = )\"[^\"]*\";|\$1\"\";|" flake.nix
  log=$(nix build --no-link -L ".#pocketbase.$attr" 2>&1) || true
  hash=$(sed -n 's/^ *got: *\(sha256-[A-Za-z0-9+/=]*\).*/\1/p' <<<"$log" | tail -n1)
  if [[ -z $hash ]]; then
    echo "$log" >&2
    echo "nix reported no hash for .#pocketbase.$attr" >&2
    exit 1
  fi
  perl -pi -e "s|^(\s*$field = )\"\";|\$1\"$hash\";|" flake.nix
  echo "$field = $hash"
}
update_hash src hash
update_hash goModules vendorHash
