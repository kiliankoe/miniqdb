use std::io::{IsTerminal, Write};

use anyhow::{Result, bail};

use crate::commands::{authed_client, explain_denied, find_quote};
use crate::output::format_date;

pub fn run(short_id: i64, yes: bool) -> Result<()> {
    let (client, _) = authed_client()?;
    let quote = find_quote(&client, short_id)?;

    if !yes {
        // Deleting is irreversible, so never assume consent from a pipe.
        if !std::io::stdin().is_terminal() {
            bail!("refusing to delete without confirmation – pass --yes");
        }
        eprintln!("#{} · {}", quote.short_id, format_date(&quote.created));

        for line in quote.text.lines() {
            eprintln!("  {line}");
        }
        if !confirm("Delete this quote? [y/N] ")? {
            eprintln!("Aborted");
            return Ok(());
        }
    }
    client
        .delete_quote(&quote.id)
        .map_err(|e| explain_denied(e, "delete", short_id))?;

    println!("Deleted quote #{short_id}");
    Ok(())
}

fn confirm(prompt: &str) -> Result<bool> {
    let mut err = std::io::stderr();
    write!(err, "{prompt}")?;
    err.flush()?;
    let mut line = String::new();
    std::io::stdin().read_line(&mut line)?;
    Ok(matches!(line.trim(), "y" | "Y" | "yes"))
}
