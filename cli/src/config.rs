use std::fmt;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use etcetera::BaseStrategy;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub url: String,
    pub token: String,
    pub email: String,
}

pub fn config_path() -> Result<PathBuf> {
    let strategy = etcetera::choose_base_strategy().context("cannot locate config directory")?;
    Ok(strategy.config_dir().join("mqdb").join("config.json"))
}

impl Config {
    pub fn load() -> Result<Option<Config>> {
        Self::load_from(&config_path()?)
    }

    pub fn load_required() -> Result<Config> {
        Self::load()?.ok_or_else(|| NotLoggedIn.into())
    }

    pub fn save(&self) -> Result<()> {
        self.save_to(&config_path()?)
    }

    fn load_from(path: &Path) -> Result<Option<Config>> {
        match fs::read_to_string(path) {
            Ok(contents) => Ok(Some(
                serde_json::from_str(&contents)
                    .with_context(|| format!("invalid config at {}", path.display()))?,
            )),
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(err) => Err(err).with_context(|| format!("cannot read {}", path.display())),
        }
    }

    fn save_to(&self, path: &Path) -> Result<()> {
        let dir = path.parent().context("config path has no parent")?;
        fs::create_dir_all(dir)?;
        // Temp file + rename so a crash never leaves a torn config; 0600 because
        // the file holds the auth token.
        let tmp = dir.join(".config.json.tmp");
        {
            let mut options = fs::OpenOptions::new();
            options.write(true).create(true).truncate(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            let mut file = options.open(&tmp)?;
            file.write_all(serde_json::to_string_pretty(self)?.as_bytes())?;
            file.write_all(b"\n")?;
        }
        fs::rename(&tmp, path)?;
        Ok(())
    }
}

pub fn normalize_url(input: &str) -> String {
    let trimmed = input.trim().trim_end_matches('/');
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    }
}

#[derive(Debug)]
pub struct NotLoggedIn;

impl fmt::Display for NotLoggedIn {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "not logged in — run 'mqdb login'")
    }
}

impl std::error::Error for NotLoggedIn {}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Config {
        Config {
            url: "https://quotes.example.com".into(),
            token: "tok".into(),
            email: "me@example.com".into(),
        }
    }

    #[test]
    fn save_and_load_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("mqdb").join("config.json");
        sample().save_to(&path).unwrap();
        let loaded = Config::load_from(&path).unwrap().unwrap();
        assert_eq!(loaded.url, "https://quotes.example.com");
        assert_eq!(loaded.email, "me@example.com");
    }

    #[test]
    fn missing_file_loads_as_none() {
        let dir = tempfile::tempdir().unwrap();
        assert!(
            Config::load_from(&dir.path().join("nope.json"))
                .unwrap()
                .is_none()
        );
    }

    #[cfg(unix)]
    #[test]
    fn config_file_is_private() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("config.json");
        sample().save_to(&path).unwrap();
        let mode = fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o600);
    }

    #[test]
    fn normalize_url_adds_scheme_and_strips_slash() {
        assert_eq!(
            normalize_url("quotes.example.com/"),
            "https://quotes.example.com"
        );
        assert_eq!(
            normalize_url("http://localhost:8090"),
            "http://localhost:8090"
        );
        assert_eq!(normalize_url("  https://a.b/ "), "https://a.b");
    }
}
