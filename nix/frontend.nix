{
  lib,
  stdenvNoCC,
  bun,
  nodejs,
  writableTmpDirAsHomeHook,
}:

let
  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../index.html
      ../package.json
      ../bun.lock
      ../public
      ../src
      ../tsconfig.json
      ../vite-env.d.ts
      ../vite.config.ts
    ];
  };

  # The sandbox has no network, so dependencies come from a fixed-output
  # derivation. Any bun.lock change needs a new outputHash: build, then copy the
  # hash from the mismatch error. `--cpu`/`--os` fetch every platform's native
  # binaries (esbuild, rollup), which keeps the hash the same on every system.
  node_modules = stdenvNoCC.mkDerivation {
    pname = "miniqdb-node_modules";
    version = "0";
    inherit src;

    nativeBuildInputs = [
      bun
      writableTmpDirAsHomeHook
    ];

    dontConfigure = true;

    buildPhase = ''
      runHook preBuild
      bun install --frozen-lockfile --ignore-scripts --no-progress --cpu="*" --os="*"
      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall
      cp -R node_modules $out
      runHook postInstall
    '';

    # A fixed-output derivation must not reference store paths.
    dontFixup = true;

    outputHash = "sha256-94y6XaBSGmnc1ZUTUkP/kVPonVK0ejGQL4oLBpFBvWc=";
    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
  };
in
stdenvNoCC.mkDerivation {
  pname = "miniqdb-frontend";
  version = "0";
  inherit src;

  nativeBuildInputs = [
    bun
    nodejs
  ];

  configurePhase = ''
    runHook preConfigure
    cp -R ${node_modules} node_modules
    chmod -R u+w node_modules
    patchShebangs node_modules
    runHook postConfigure
  '';

  buildPhase = ''
    runHook preBuild
    bun run build
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    cp -R dist $out
    runHook postInstall
  '';
}
