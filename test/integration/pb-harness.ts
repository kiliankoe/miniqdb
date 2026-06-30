import { execFileSync, spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import PocketBase from "pocketbase";

// Pin to the same version the production Dockerfile builds against.
const PB_VERSION = "0.36.2";
const SUPERUSER_EMAIL = "admin@test.local";
const SUPERUSER_PASSWORD = "test-password-123";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const cacheDir = join(repoRoot, ".pb-test");
const hooksDir = join(repoRoot, "pocketbase", "pb_hooks");
const migrationsDir = join(repoRoot, "pocketbase", "pb_migrations");

function platform() {
  const os =
    process.platform === "darwin"
      ? "darwin"
      : process.platform === "win32"
        ? "windows"
        : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "amd64";
  const ext = os === "windows" ? ".exe" : "";
  return { os, arch, ext };
}

async function ensureBinary(): Promise<string> {
  const { os, arch, ext } = platform();
  const binPath = join(cacheDir, `pocketbase-${PB_VERSION}${ext}`);
  if (existsSync(binPath)) return binPath;

  mkdirSync(cacheDir, { recursive: true });
  const zipName = `pocketbase_${PB_VERSION}_${os}_${arch}.zip`;
  const url = `https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${zipName}`;
  const zipPath = join(cacheDir, zipName);

  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download PocketBase from ${url}: ${res.status}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(zipPath));

  // The archive contains a `pocketbase` executable; extract and rename it so
  // the cache can hold multiple pinned versions side by side.
  execFileSync("unzip", ["-o", zipPath, "pocketbase" + ext, "-d", cacheDir]);
  execFileSync("mv", [join(cacheDir, "pocketbase" + ext), binPath]);
  execFileSync("chmod", ["+x", binPath]);
  rmSync(zipPath);
  return binPath;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on("error", reject);
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForReady(url: string, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`PocketBase at ${url} did not become ready in time`);
}

export interface TestPocketBase {
  url: string;
  /** A PocketBase client authenticated as a superuser (bypasses API rules). */
  pb: PocketBase;
  stop: () => Promise<void>;
}

/**
 * Boot a throwaway PocketBase instance using the real migrations and hooks
 * from `pocketbase/`. `env` is passed through to the server process so hooks
 * that read env vars (domain validation, admin reconciliation) can be tested.
 */
export async function startPocketBase(
  env: Record<string, string> = {},
): Promise<TestPocketBase> {
  const binPath = await ensureBinary();
  const dataDir = await mkdtemp(join(tmpdir(), "miniqdb-pb-"));
  const childEnv = { ...process.env, ...env };
  const sharedArgs = [
    `--dir=${dataDir}`,
    `--hooksDir=${hooksDir}`,
    `--migrationsDir=${migrationsDir}`,
  ];

  // Applies pending migrations and creates the superuser in one shot.
  execFileSync(
    binPath,
    ["superuser", "upsert", SUPERUSER_EMAIL, SUPERUSER_PASSWORD, ...sharedArgs],
    { env: childEnv, stdio: "ignore" },
  );

  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(
    binPath,
    ["serve", `--http=127.0.0.1:${port}`, ...sharedArgs],
    { env: childEnv, stdio: "ignore" },
  );

  try {
    await waitForReady(url);
  } catch (err) {
    child.kill("SIGKILL");
    rmSync(dataDir, { recursive: true, force: true });
    throw err;
  }

  const pb = new PocketBase(url);
  await pb
    .collection("_superusers")
    .authWithPassword(SUPERUSER_EMAIL, SUPERUSER_PASSWORD);

  const stop = async () => {
    child.kill("SIGKILL");
    rmSync(dataDir, { recursive: true, force: true });
  };

  return { url, pb, stop };
}

export { SUPERUSER_EMAIL };
