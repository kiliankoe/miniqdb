pub mod list;
pub mod login;
pub mod search;
pub mod submit;

use anyhow::Result;

use crate::api::{ApiError, Client, jwt_expired};
use crate::config::Config;

pub(crate) fn authed_client() -> Result<(Client, Config)> {
    let config = Config::load_required()?;
    if jwt_expired(&config.token) {
        return Err(ApiError::Auth("stored auth token has expired".into()).into());
    }
    let client = Client::new(&config.url, Some(config.token.clone()));
    Ok((client, config))
}
