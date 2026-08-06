use clap::{Parser, Subcommand, ValueEnum};

use crate::api::Sort;

#[derive(Parser)]
#[command(
    name = "mqdb",
    version,
    about = "CLI and TUI for miniqdb quote databases"
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Command>,
}

#[derive(Subcommand)]
pub enum Command {
    /// Log in to a miniqdb instance (interactive OTP, or --token for API tokens)
    Login {
        /// Instance base URL, e.g. https://quotes.example.com
        #[arg(long)]
        url: Option<String>,
        /// Email to request the OTP code for
        #[arg(long)]
        email: Option<String>,
        /// Use an existing auth token (e.g. from scripts/mint-token.ts) instead of OTP
        #[arg(long, requires = "url")]
        token: Option<String>,
    },
    /// List quotes
    List {
        #[arg(long, value_enum, default_value_t)]
        sort: SortArg,
        #[arg(long, default_value_t = 1)]
        page: u32,
        #[arg(long, default_value_t = 10)]
        limit: u32,
        /// Output the raw PocketBase page as JSON (plus own vote per quote)
        #[arg(long)]
        json: bool,
    },
    /// Submit a new quote (from the argument, or stdin when omitted)
    Submit {
        text: Option<String>,
        /// Output the created record as JSON
        #[arg(long)]
        json: bool,
    },
    /// Edit a quote's text (admins can edit any quote, authors their own)
    Edit {
        /// Quote number as shown in listings (#42 -> 42)
        quote: i64,
        /// Replacement text (read from stdin when omitted)
        text: Option<String>,
        /// Output the updated record as JSON
        #[arg(long)]
        json: bool,
    },
    /// Delete a quote (admins can delete any quote, authors their own)
    Delete {
        /// Quote number as shown in listings (#42 -> 42)
        quote: i64,
        /// Skip the confirmation prompt
        #[arg(short, long)]
        yes: bool,
    },
    /// Search quotes by text (sorted by score)
    Search {
        query: String,
        #[arg(long, default_value_t = 50)]
        limit: u32,
        /// Output results as JSON
        #[arg(long)]
        json: bool,
    },
}

#[derive(ValueEnum, Clone, Copy, Debug, Default)]
pub enum SortArg {
    #[default]
    #[value(alias = "latest")]
    Newest,
    Oldest,
    Top,
    Random,
}

impl From<SortArg> for Sort {
    fn from(arg: SortArg) -> Self {
        match arg {
            SortArg::Newest => Sort::Newest,
            SortArg::Oldest => Sort::Oldest,
            SortArg::Top => Sort::Top,
            SortArg::Random => Sort::Random,
        }
    }
}
