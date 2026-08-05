use std::io::Write;

use anyhow::{Context, Result, bail};

use crate::api::{Client, jwt_record_id};
use crate::config::{Config, normalize_url};

pub fn run(url: Option<String>, email: Option<String>, token: Option<String>) -> Result<()> {
    let existing = Config::load()?;

    if let Some(token) = token {
        // clap enforces --url alongside --token.
        let url = normalize_url(&url.expect("clap requires --url with --token"));
        let record_id =
            jwt_record_id(&token).context("--token does not look like a PocketBase auth token")?;
        let client = Client::new(&url, Some(token.clone()));
        // Fetching the own user record both validates the token and recovers the email.
        let user = client.get_user(&record_id)?;
        Config {
            url: url.clone(),
            token,
            email: user.email.clone(),
        }
        .save()?;
        println!("Logged in as {} ({url})", user.email);
        return Ok(());
    }

    let url = normalize_url(&match url {
        Some(url) => url,
        None => prompt("Instance URL", existing.as_ref().map(|c| c.url.as_str()))?,
    });
    let email = match email {
        Some(email) => email,
        None => prompt("Email", existing.as_ref().map(|c| c.email.as_str()))?,
    };

    let client = Client::new(&url, None);
    let otp_id = client.request_otp(&email)?;
    eprintln!("Check your email for a login code.");
    let code = prompt("Code", None)?;
    let auth = client.auth_with_otp(&otp_id, &code)?;

    Config {
        url: url.clone(),
        token: auth.token,
        email: auth.record.email.clone(),
    }
    .save()?;
    println!("Logged in as {} ({url})", auth.record.email);
    Ok(())
}

fn prompt(label: &str, default: Option<&str>) -> Result<String> {
    let mut err = std::io::stderr();
    match default {
        Some(default) => write!(err, "{label} [{default}]: ")?,
        None => write!(err, "{label}: ")?,
    }
    err.flush()?;

    let mut line = String::new();
    std::io::stdin().read_line(&mut line)?;
    let value = line.trim();
    if value.is_empty() {
        if let Some(default) = default {
            return Ok(default.to_string());
        }
        bail!("{label} is required");
    }
    Ok(value.to_string())
}
