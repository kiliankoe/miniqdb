pub mod delete;
pub mod edit;
pub mod list;
pub mod login;
pub mod search;
pub mod submit;

use anyhow::{Result, anyhow};

use crate::api::{ApiError, Client, Quote, jwt_expired};
use crate::config::Config;

pub(crate) fn authed_client() -> Result<(Client, Config)> {
    let config = Config::load_required()?;
    if jwt_expired(&config.token) {
        return Err(ApiError::Auth("stored auth token has expired".into()).into());
    }
    let client = Client::new(&config.url, Some(config.token.clone()));
    Ok((client, config))
}

pub(crate) fn find_quote(client: &Client, short_id: i64) -> Result<Quote> {
    client
        .quote_by_short_id(short_id)?
        .ok_or_else(|| anyhow!("no quote #{short_id}"))
}

/// PocketBase rules act as filters, so writing to a quote the caller may not
/// touch comes back as a bare 404. The quote was just found by number, so say
/// what that 404 actually means here.
pub(crate) fn explain_denied(err: ApiError, action: &str, short_id: i64) -> anyhow::Error {
    match err {
        ApiError::Api { status: 404, .. } => {
            anyhow!("cannot {action} quote #{short_id} – that needs admin rights or authorship")
        }
        other => other.into(),
    }
}
