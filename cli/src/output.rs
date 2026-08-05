//! Human and JSON rendering shared by list/search/submit.

use crate::api::{Page, Quote, QuoteWithVote};

/// PocketBase dates are `YYYY-MM-DD hh:mm:ss.sssZ`; render as `DD.MM.YY`.
pub fn format_date(created: &str) -> String {
    match (created.get(8..10), created.get(5..7), created.get(2..4)) {
        (Some(day), Some(month), Some(year)) => format!("{day}.{month}.{year}"),
        _ => created.to_string(),
    }
}

pub fn print_quote(q: &QuoteWithVote) {
    let vote = match q.vote {
        1 => " · ▲you",
        -1 => " · ▼you",
        _ => "",
    };
    println!(
        "#{} · {} · score {}{vote}",
        q.quote.short_id,
        format_date(&q.quote.created),
        q.quote.score
    );
    for line in q.quote.text.lines() {
        println!("  {line}");
    }
}

pub fn print_quotes(quotes: &[QuoteWithVote]) {
    for (i, quote) in quotes.iter().enumerate() {
        if i > 0 {
            println!();
        }
        print_quote(quote);
    }
}

pub fn print_page_json(page: &Page<Quote>, enriched: Vec<QuoteWithVote>) -> anyhow::Result<()> {
    let out = Page {
        page: page.page,
        per_page: page.per_page,
        total_items: page.total_items,
        total_pages: page.total_pages,
        items: enriched,
    };
    println!("{}", serde_json::to_string_pretty(&out)?);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_date_slices_pocketbase_timestamps() {
        assert_eq!(format_date("2026-08-05 08:26:17.233Z"), "05.08.26");
        assert_eq!(format_date("garbage"), "garbage");
    }
}
