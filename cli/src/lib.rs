pub mod api;
pub mod cli;
pub mod commands;
pub mod config;
pub mod output;
pub mod tui;

use cli::{Cli, Command};

pub fn run(cli: Cli) -> anyhow::Result<()> {
    match cli.command {
        None => tui::run(),
        Some(Command::Login { url, email, token }) => commands::login::run(url, email, token),
        Some(Command::List {
            sort,
            page,
            limit,
            json,
        }) => commands::list::run(sort.into(), page, limit, json),
        Some(Command::Submit { text, json }) => commands::submit::run(text, json),
        Some(Command::Search { query, limit, json }) => commands::search::run(&query, limit, json),
    }
}
