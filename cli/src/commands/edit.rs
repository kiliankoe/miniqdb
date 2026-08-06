use std::io::{IsTerminal, Read};

use anyhow::{Result, bail};

use crate::commands::{authed_client, explain_denied, find_quote};

pub fn run(short_id: i64, text: Option<String>, json: bool) -> Result<()> {
    let (client, _) = authed_client()?;
    let quote = find_quote(&client, short_id)?;

    let text = match text {
        Some(text) => text,
        None => {
            if std::io::stdin().is_terminal() {
                eprintln!("Current text of #{short_id}:");
                for line in quote.text.lines() {
                    eprintln!("  {line}");
                }
                eprintln!("Reading the replacement from stdin – end with Ctrl-D");
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

    let updated = client
        .update_quote(&quote.id, text)
        .map_err(|e| explain_denied(e, "edit", short_id))?;

    if json {
        println!("{}", serde_json::to_string_pretty(&updated)?);
    } else {
        println!("Updated quote #{}", updated.short_id);
    }
    Ok(())
}
