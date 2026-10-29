{
  lib,
  stdenvNoCC,
  bun2nix,
}:

stdenvNoCC.mkDerivation {
  pname = "miniqdb-frontend";
  version = "0";

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

  nativeBuildInputs = [ bun2nix.hook ];

  # bun.nix is generated from bun.lock by the postinstall script and checked
  # by CI, so a dependency bump needs no hand-edited hash here.
  bunDeps = bun2nix.fetchBunDeps { bunNix = ../bun.nix; };

  # No dependency needs its install script, and the project's own postinstall
  # would only regenerate bun.nix.
  dontRunLifecycleScripts = true;

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
