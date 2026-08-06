use std::collections::HashMap;
use std::fmt;
use std::time::Duration;

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Sort {
    Newest,
    Oldest,
    Top,
    Random,
}

impl Sort {
    // Mirrors getSortString in src/lib/queries.ts.
    pub fn sort_string(self) -> &'static str {
        match self {
            Sort::Newest => "-created",
            Sort::Oldest => "+created",
            Sort::Top => "-score,-created",
            Sort::Random => "@random",
        }
    }

    /// Tab label as the website's Navigation shows it.
    pub fn label(self) -> &'static str {
        match self {
            Sort::Newest => "#latest",
            Sort::Oldest => "#oldest",
            Sort::Top => "#top",
            Sort::Random => "#random",
        }
    }
}

// Mirrors escapeFilterString in src/lib/queries.ts: backslash first, then quote.
pub fn escape_filter(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn jwt_claims(token: &str) -> Option<Value> {
    let payload = token.split('.').nth(1)?;
    let bytes = URL_SAFE_NO_PAD.decode(payload).ok()?;
    serde_json::from_slice(&bytes).ok()
}

/// Extract the auth record id from a PocketBase JWT without verifying it.
pub fn jwt_record_id(token: &str) -> Option<String> {
    jwt_claims(token)?.get("id")?.as_str().map(String::from)
}

/// Local expiry check. PocketBase treats invalid tokens as guests on record
/// routes (empty lists, no 401), so waiting for a server error would fail
/// silently — this catches the common case up front.
pub fn jwt_expired(token: &str) -> bool {
    let Some(exp) = jwt_claims(token).and_then(|c| c.get("exp")?.as_i64()) else {
        return false;
    };
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    exp < now
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Quote {
    pub id: String,
    pub text: String,
    pub author: String,
    pub short_id: i64,
    pub score: i64,
    pub created: String,
    pub updated: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vote {
    pub id: String,
    pub quote: String,
    pub author: String,
    pub value: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page<T> {
    pub page: u32,
    pub per_page: u32,
    pub total_items: i64,
    pub total_pages: i64,
    pub items: Vec<T>,
}

#[derive(Debug, Clone, Serialize)]
pub struct QuoteWithVote {
    #[serde(flatten)]
    pub quote: Quote,
    pub vote: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UserRecord {
    pub id: String,
    pub email: String,
    #[serde(default, rename = "isAdmin")]
    pub is_admin: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub record: UserRecord,
}

#[derive(Debug)]
pub enum ApiError {
    /// 401/403 — the caller should suggest `mqdb login` (exit code 3).
    Auth(String),
    Api {
        status: u16,
        message: String,
    },
    Transport(String),
}

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ApiError::Auth(msg) => write!(f, "{msg} — run 'mqdb login'"),
            ApiError::Api { message, .. } => write!(f, "{message}"),
            ApiError::Transport(msg) => write!(f, "{msg}"),
        }
    }
}

impl std::error::Error for ApiError {}

// Mirrors extractError in src/routes/login.tsx, with field names prefixed.
fn parse_error(status: u16, body: Value) -> ApiError {
    let mut parts: Vec<String> = Vec::new();
    if let Some(data) = body.get("data").and_then(Value::as_object) {
        for (field, value) in data {
            if let Some(msg) = value.get("message").and_then(Value::as_str) {
                parts.push(format!("{field}: {msg}"));
            }
        }
    }
    let message = if parts.is_empty() {
        body.get("message")
            .and_then(Value::as_str)
            .filter(|m| !m.is_empty())
            .map(String::from)
            .unwrap_or_else(|| format!("request failed (status {status})"))
    } else {
        parts.join(" ")
    };
    if status == 401 || status == 403 {
        ApiError::Auth(message)
    } else {
        ApiError::Api { status, message }
    }
}

fn from_value<T: DeserializeOwned>(value: Value) -> Result<T, ApiError> {
    serde_json::from_value(value)
        .map_err(|e| ApiError::Transport(format!("unexpected response: {e}")))
}

pub struct Client {
    base_url: String,
    token: Option<String>,
    agent: ureq::Agent,
}

impl Client {
    pub fn new(base_url: &str, token: Option<String>) -> Self {
        let config = ureq::Agent::config_builder()
            // We parse PocketBase's error JSON ourselves.
            .http_status_as_error(false)
            .timeout_global(Some(Duration::from_secs(15)))
            .build();
        Client {
            base_url: base_url.trim_end_matches('/').to_string(),
            token,
            agent: config.new_agent(),
        }
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    fn handle(mut res: ureq::http::Response<ureq::Body>) -> Result<Value, ApiError> {
        let status = res.status().as_u16();
        // DELETE returns 204 with an empty body.
        let value: Value = res.body_mut().read_json().unwrap_or(Value::Null);
        if (200..300).contains(&status) {
            Ok(value)
        } else {
            Err(parse_error(status, value))
        }
    }

    fn get(&self, path: &str, query: &[(&str, &str)]) -> Result<Value, ApiError> {
        let mut req = self.agent.get(self.url(path));
        for (key, value) in query {
            req = req.query(*key, *value);
        }
        if let Some(token) = &self.token {
            req = req.header("Authorization", token);
        }
        let res = req.call().map_err(|e| ApiError::Transport(e.to_string()))?;
        Self::handle(res)
    }

    fn send(&self, method: &str, path: &str, body: &Value) -> Result<Value, ApiError> {
        let req = match method {
            "POST" => self.agent.post(self.url(path)),
            "PATCH" => self.agent.patch(self.url(path)),
            other => unreachable!("unsupported method {other}"),
        };
        let req = match &self.token {
            Some(token) => req.header("Authorization", token),
            None => req,
        };
        let res = req
            .send_json(body)
            .map_err(|e| ApiError::Transport(e.to_string()))?;
        Self::handle(res)
    }

    fn delete(&self, path: &str) -> Result<(), ApiError> {
        let mut req = self.agent.delete(self.url(path));
        if let Some(token) = &self.token {
            req = req.header("Authorization", token);
        }
        let res = req.call().map_err(|e| ApiError::Transport(e.to_string()))?;
        Self::handle(res).map(|_| ())
    }

    // --- auth ---

    pub fn request_otp(&self, email: &str) -> Result<String, ApiError> {
        let v = self.send(
            "POST",
            "/api/collections/users/request-otp",
            &json!({ "email": email }),
        )?;
        v.get("otpId")
            .and_then(Value::as_str)
            .map(String::from)
            .ok_or_else(|| ApiError::Transport("missing otpId in response".into()))
    }

    pub fn auth_with_otp(&self, otp_id: &str, code: &str) -> Result<AuthResponse, ApiError> {
        from_value(self.send(
            "POST",
            "/api/collections/users/auth-with-otp",
            &json!({ "otpId": otp_id, "password": code }),
        )?)
    }

    pub fn auth_refresh(&self) -> Result<AuthResponse, ApiError> {
        from_value(self.send("POST", "/api/collections/users/auth-refresh", &json!({}))?)
    }

    pub fn get_user(&self, id: &str) -> Result<UserRecord, ApiError> {
        from_value(self.get(&format!("/api/collections/users/records/{id}"), &[])?)
    }

    /// Mirrors fetchIsAdmin in src/lib/queries.ts: read the live user record so
    /// an ADMIN_EMAILS promotion applies without logging in again.
    pub fn is_admin(&self) -> Result<bool, ApiError> {
        let Some(id) = self.token.as_deref().and_then(jwt_record_id) else {
            return Ok(false);
        };
        Ok(self.get_user(&id)?.is_admin)
    }

    // --- quotes ---

    pub fn list_quotes(
        &self,
        sort: Sort,
        page: u32,
        per_page: u32,
    ) -> Result<Page<Quote>, ApiError> {
        from_value(self.get(
            "/api/collections/quotes/records",
            &[
                ("page", &page.to_string()),
                ("perPage", &per_page.to_string()),
                ("sort", sort.sort_string()),
            ],
        )?)
    }

    // Mirrors useSearchQuotes: score-sorted, single page.
    pub fn search_quotes(&self, query: &str, limit: u32) -> Result<Page<Quote>, ApiError> {
        let filter = format!("text ~ \"{}\"", escape_filter(query));
        from_value(self.get(
            "/api/collections/quotes/records",
            &[
                ("page", "1"),
                ("perPage", &limit.to_string()),
                ("sort", "-score"),
                ("filter", &filter),
            ],
        )?)
    }

    /// `author` must be the authenticated user's email (API rule).
    pub fn submit_quote(&self, text: &str, author: &str) -> Result<Quote, ApiError> {
        from_value(self.send(
            "POST",
            "/api/collections/quotes/records",
            &json!({ "text": text, "author": author }),
        )?)
    }

    /// Quotes are addressed by `#shortId` everywhere the user sees them, but
    /// the write endpoints need the record id.
    pub fn quote_by_short_id(&self, short_id: i64) -> Result<Option<Quote>, ApiError> {
        let filter = format!("shortId = {short_id}");
        let page: Page<Quote> = from_value(self.get(
            "/api/collections/quotes/records",
            &[("perPage", "1"), ("filter", &filter)],
        )?)?;
        Ok(page.items.into_iter().next())
    }

    /// Admins may edit any quote, authors their own (the quotes updateRule)
    pub fn update_quote(&self, id: &str, text: &str) -> Result<Quote, ApiError> {
        from_value(self.send(
            "PATCH",
            &format!("/api/collections/quotes/records/{id}"),
            &json!({ "text": text }),
        )?)
    }

    /// Same rights as editing. The quote's votes are cascade-deleted with it.
    pub fn delete_quote(&self, id: &str) -> Result<(), ApiError> {
        self.delete(&format!("/api/collections/quotes/records/{id}"))
    }

    // --- votes ---

    pub fn my_votes(&self, email: &str, quote_ids: &[&str]) -> Result<Vec<Vote>, ApiError> {
        if quote_ids.is_empty() {
            return Ok(Vec::new());
        }
        // Same batched OR filter as enrichWithVotes in src/lib/queries.ts.
        let quote_filter = quote_ids
            .iter()
            .map(|id| format!("quote = \"{id}\""))
            .collect::<Vec<_>>()
            .join(" || ");
        let filter = format!("author = \"{}\" && ({quote_filter})", escape_filter(email));
        let page: Page<Vote> = from_value(self.get(
            "/api/collections/votes/records",
            &[("perPage", "500"), ("filter", &filter)],
        )?)?;
        Ok(page.items)
    }

    /// value 1/-1 sets the vote, 0 clears it (vote records are deleted, never zeroed).
    pub fn set_vote(&self, quote_id: &str, email: &str, value: i64) -> Result<(), ApiError> {
        let filter = format!(
            "quote = \"{quote_id}\" && author = \"{}\"",
            escape_filter(email)
        );
        let existing: Page<Vote> = from_value(self.get(
            "/api/collections/votes/records",
            &[("perPage", "1"), ("filter", &filter)],
        )?)?;
        match (existing.items.into_iter().next(), value) {
            (Some(vote), 0) => self.delete(&format!("/api/collections/votes/records/{}", vote.id)),
            (None, 0) => Ok(()),
            (Some(vote), value) => self
                .send(
                    "PATCH",
                    &format!("/api/collections/votes/records/{}", vote.id),
                    &json!({ "value": value }),
                )
                .map(|_| ()),
            (None, value) => self
                .send(
                    "POST",
                    "/api/collections/votes/records",
                    &json!({ "quote": quote_id, "author": email, "value": value }),
                )
                .map(|_| ()),
        }
    }

    /// Merge own votes into a quote list; failures degrade to vote 0 like the website.
    pub fn enrich_with_votes(&self, email: &str, quotes: Vec<Quote>) -> Vec<QuoteWithVote> {
        let ids: Vec<&str> = quotes.iter().map(|q| q.id.as_str()).collect();
        let votes = self.my_votes(email, &ids).unwrap_or_default();
        let by_quote: HashMap<&str, i64> =
            votes.iter().map(|v| (v.quote.as_str(), v.value)).collect();
        quotes
            .into_iter()
            .map(|quote| {
                let vote = by_quote.get(quote.id.as_str()).copied().unwrap_or(0);
                QuoteWithVote { quote, vote }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sort_strings_match_the_website() {
        assert_eq!(Sort::Newest.sort_string(), "-created");
        assert_eq!(Sort::Oldest.sort_string(), "+created");
        assert_eq!(Sort::Top.sort_string(), "-score,-created");
        assert_eq!(Sort::Random.sort_string(), "@random");
    }

    #[test]
    fn escape_filter_escapes_backslash_before_quote() {
        assert_eq!(escape_filter(r#"a"b\c"#), r#"a\"b\\c"#);
        assert_eq!(escape_filter(r#"\""#), r#"\\\""#);
    }

    #[test]
    fn parse_error_flattens_field_messages() {
        let body = json!({
            "status": 400,
            "message": "Failed to create record.",
            "data": { "text": { "code": "validation_required", "message": "Missing required value." } }
        });
        let err = parse_error(400, body);
        assert_eq!(err.to_string(), "text: Missing required value.");
    }

    #[test]
    fn parse_error_falls_back_to_top_level_message() {
        let err = parse_error(
            400,
            json!({ "message": "Something went wrong.", "data": {} }),
        );
        assert_eq!(err.to_string(), "Something went wrong.");
        let err = parse_error(500, Value::Null);
        assert_eq!(err.to_string(), "request failed (status 500)");
    }

    #[test]
    fn parse_error_maps_401_to_auth() {
        let err = parse_error(
            401,
            json!({ "message": "The request requires valid record authorization token." }),
        );
        assert!(matches!(err, ApiError::Auth(_)));
        assert!(err.to_string().contains("mqdb login"));
    }

    #[test]
    fn jwt_record_id_decodes_the_payload() {
        let payload = URL_SAFE_NO_PAD.encode(r#"{"id":"abc123","type":"auth"}"#);
        let token = format!("eyJhbGciOiJIUzI1NiJ9.{payload}.signature");
        assert_eq!(jwt_record_id(&token), Some("abc123".to_string()));
        assert_eq!(jwt_record_id("not-a-jwt"), None);
    }

    #[test]
    fn jwt_expired_compares_exp_against_now() {
        let token = |exp: i64| {
            let payload = URL_SAFE_NO_PAD.encode(format!(r#"{{"id":"x","exp":{exp}}}"#));
            format!("h.{payload}.s")
        };
        assert!(jwt_expired(&token(1_000_000)));
        assert!(!jwt_expired(&token(4_000_000_000)));
        // No exp claim / undecodable → assume valid, let the server decide.
        assert!(!jwt_expired("not-a-jwt"));
    }
}
