use std::io::{IsTerminal, Read};

use anyhow::{Result, bail};

use crate::commands::authed_client;

pub fn run(text: Option<String>, json: bool) -> Result<()> {
    let text = match text {
        Some(text) => text,
        None => {
            if std::io::stdin().is_terminal() {
                eprintln!("Reading quote from stdin — end with Ctrl-D");
            }
            let mut buf = String::new();
            std::io::stdin().read_to_string(&mut buf)?;
            buf
        }
    };
    let text = text.trim();
    // Same minimum the website enforces client-side.
    if text.chars().count() < 5 {
        bail!("quote must be at least 5 characters");
    }

    let (client, config) = authed_client()?;
    let quote = client.submit_quote(text, &config.email)?;

    if json {
        println!("{}", serde_json::to_string_pretty(&quote)?);
    } else {
        println!("Submitted quote #{}", quote.short_id);
    }
    Ok(())
}
