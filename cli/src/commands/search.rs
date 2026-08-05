use anyhow::Result;

use crate::commands::authed_client;
use crate::output;

pub fn run(query: &str, limit: u32, json: bool) -> Result<()> {
    let (client, config) = authed_client()?;
    let result = client.search_quotes(query, limit)?;
    let enriched = client.enrich_with_votes(&config.email, result.items.clone());

    if json {
        return output::print_page_json(&result, enriched);
    }

    output::print_quotes(&enriched);
    if !enriched.is_empty() {
        println!();
    }
    if result.total_items > enriched.len() as i64 {
        println!(
            "{} results (showing first {})",
            result.total_items,
            enriched.len()
        );
    } else {
        println!("{} results", result.total_items);
    }
    Ok(())
}
