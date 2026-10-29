//! Boots a throwaway PocketBase with the real migrations and hooks, mirroring
//! test/integration/pb-harness.ts. Shares the same pinned binary cache in
//! `.pb-test/` at the repo root.

use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use serde_json::{Value, json};

const SUPERUSER_EMAIL: &str = "admin@test.local";
const SUPERUSER_PASSWORD: &str = "test-password-123";

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("cli/ lives in the repo root")
        .to_path_buf()
}

/// The Dockerfile's ARG is the single version pin, shared with the flake and
/// the web harness, so the update workflow has only one place to bump.
fn pinned_version() -> String {
    let dockerfile = std::fs::read_to_string(repo_root().join("pocketbase/Dockerfile"))
        .expect("read pocketbase/Dockerfile");
    dockerfile
        .lines()
        .find_map(|line| line.strip_prefix("ARG PB_VERSION="))
        .expect("ARG PB_VERSION in pocketbase/Dockerfile")
        .trim()
        .to_string()
}

fn ensure_binary() -> &'static Path {
    static BIN: OnceLock<PathBuf> = OnceLock::new();
    BIN.get_or_init(|| {
        let pb_version = pinned_version();
        let cache = repo_root().join(".pb-test");
        let bin = cache.join(format!("pocketbase-{pb_version}"));
        if bin.exists() {
            return bin;
        }
        std::fs::create_dir_all(&cache).unwrap();
        let (os, arch) = match (std::env::consts::OS, std::env::consts::ARCH) {
            ("macos", "aarch64") => ("darwin", "arm64"),
            ("macos", _) => ("darwin", "amd64"),
            (_, "aarch64") => ("linux", "arm64"),
            _ => ("linux", "amd64"),
        };
        let zip_name = format!("pocketbase_{pb_version}_{os}_{arch}.zip");
        let url = format!(
            "https://github.com/pocketbase/pocketbase/releases/download/v{pb_version}/{zip_name}"
        );
        let zip_path = cache.join(&zip_name);
        let mut res = ureq::get(&url).call().expect("download PocketBase");
        let mut file = std::fs::File::create(&zip_path).unwrap();
        std::io::copy(&mut res.body_mut().as_reader(), &mut file).unwrap();

        let status = Command::new("unzip")
            .args(["-o", zip_path.to_str().unwrap(), "pocketbase", "-d"])
            .arg(&cache)
            .status()
            .expect("unzip PocketBase");
        assert!(status.success(), "unzip failed");
        std::fs::rename(cache.join("pocketbase"), &bin).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&bin, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        std::fs::remove_file(&zip_path).ok();
        bin
    })
}

fn free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

pub struct TestPb {
    pub url: String,
    child: Child,
    _data_dir: tempfile::TempDir,
    admin_token: String,
}

impl TestPb {
    pub fn start() -> TestPb {
        let bin = ensure_binary();
        let data_dir = tempfile::tempdir().unwrap();
        let root = repo_root();
        let shared_args = [
            format!("--dir={}", data_dir.path().display()),
            format!("--hooksDir={}", root.join("pocketbase/pb_hooks").display()),
            format!(
                "--migrationsDir={}",
                root.join("pocketbase/pb_migrations").display()
            ),
        ];

        // Applies migrations and creates the superuser in one shot.
        let status = Command::new(bin)
            .args(["superuser", "upsert", SUPERUSER_EMAIL, SUPERUSER_PASSWORD])
            .args(&shared_args)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .expect("run pocketbase superuser upsert");
        assert!(status.success(), "superuser upsert failed");

        let port = free_port();
        let url = format!("http://127.0.0.1:{port}");
        let child = Command::new(bin)
            .args(["serve", &format!("--http=127.0.0.1:{port}")])
            .args(&shared_args)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn pocketbase serve");

        let deadline = Instant::now() + Duration::from_secs(30);
        loop {
            if ureq::get(format!("{url}/api/health")).call().is_ok() {
                break;
            }
            assert!(Instant::now() < deadline, "PocketBase did not become ready");
            std::thread::sleep(Duration::from_millis(100));
        }

        let auth: Value = ureq::post(format!(
            "{url}/api/collections/_superusers/auth-with-password"
        ))
        .send_json(json!({ "identity": SUPERUSER_EMAIL, "password": SUPERUSER_PASSWORD }))
        .expect("superuser auth")
        .body_mut()
        .read_json()
        .unwrap();
        let admin_token = auth["token"].as_str().unwrap().to_string();

        TestPb {
            url,
            child,
            _data_dir: data_dir,
            admin_token,
        }
    }

    /// Create a user and return an API client authenticated as them via an
    /// impersonation token (same mechanism as scripts/mint-token.ts).
    pub fn user_client(&self, email: &str) -> mqdb::api::Client {
        self.client_for(email, false)
    }

    /// Same, but flagged isAdmin – the flag the edit/delete rules key off.
    pub fn admin_client(&self, email: &str) -> mqdb::api::Client {
        self.client_for(email, true)
    }

    fn client_for(&self, email: &str, is_admin: bool) -> mqdb::api::Client {
        let user: Value = ureq::post(format!("{}/api/collections/users/records", self.url))
            .header("Authorization", &self.admin_token)
            .send_json(json!({
                "email": email,
                "password": "password12345",
                "passwordConfirm": "password12345",
                "isAdmin": is_admin,
            }))
            .expect("create user")
            .body_mut()
            .read_json()
            .unwrap();
        let user_id = user["id"].as_str().unwrap();

        let auth: Value = ureq::post(format!(
            "{}/api/collections/users/impersonate/{user_id}",
            self.url
        ))
        .header("Authorization", &self.admin_token)
        .send_json(json!({ "duration": 3600 }))
        .expect("impersonate user")
        .body_mut()
        .read_json()
        .unwrap();
        let token = auth["token"].as_str().unwrap().to_string();

        mqdb::api::Client::new(&self.url, Some(token))
    }
}

impl Drop for TestPb {
    fn drop(&mut self) {
        self.child.kill().ok();
        self.child.wait().ok();
    }
}
