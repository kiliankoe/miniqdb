use anyhow::Result;

use crate::api::Sort;
use crate::commands::authed_client;
use crate::output;

pub fn run(sort: Sort, page: u32, limit: u32, json: bool) -> Result<()> {
    let (client, config) = authed_client()?;
    let result = client.list_quotes(sort, page, limit)?;
    let enriched = client.enrich_with_votes(&config.email, result.items.clone());

    if json {
        return output::print_page_json(&result, enriched);
    }

    output::print_quotes(&enriched);
    if sort != Sort::Random && result.total_pages > 1 {
        println!();
        println!(
            "Page {}/{} · {} quotes",
            result.page, result.total_pages, result.total_items
        );
    }
    Ok(())
}
