//! Background thread owning the API client, so the UI never blocks on HTTP.

use std::sync::mpsc::{Receiver, Sender, channel};

use crate::api::{Client, Quote, QuoteWithVote, Sort};
use crate::config::Config;

#[derive(Debug)]
pub enum Request {
    Fetch {
        sort: Sort,
        page: u32,
        limit: u32,
        seq: u64,
    },
    Search {
        query: String,
        seq: u64,
    },
    Vote {
        quote_id: String,
        value: i64,
    },
    Submit {
        text: String,
    },
    Update {
        quote_id: String,
        text: String,
    },
    Delete {
        quote_id: String,
        short_id: i64,
    },
    Refresh,
    WhoAmI,
}

#[derive(Debug)]
pub struct FetchedPage {
    pub page: u32,
    pub total_pages: i64,
    pub total_items: i64,
    pub quotes: Vec<QuoteWithVote>,
}

#[derive(Debug)]
pub enum Response {
    Page {
        seq: u64,
        result: Result<FetchedPage, String>,
    },
    VoteDone {
        quote_id: String,
        result: Result<(), String>,
    },
    Submitted(Result<Quote, String>),
    Updated {
        quote_id: String,
        result: Result<Quote, String>,
    },
    Deleted {
        quote_id: String,
        short_id: i64,
        result: Result<(), String>,
    },
    Refreshed(Option<String>),
    Admin(bool),
}

pub fn spawn(config: Config) -> (Sender<Request>, Receiver<Response>) {
    let (req_tx, req_rx) = channel::<Request>();
    let (res_tx, res_rx) = channel::<Response>();

    std::thread::spawn(move || {
        let client = Client::new(&config.url, Some(config.token.clone()));
        let email = config.email;
        for request in req_rx {
            let response = match request {
                Request::Fetch {
                    sort,
                    page,
                    limit,
                    seq,
                } => Response::Page {
                    seq,
                    result: client
                        .list_quotes(sort, page, limit)
                        .map(|p| FetchedPage {
                            page: p.page,
                            total_pages: p.total_pages,
                            total_items: p.total_items,
                            quotes: client.enrich_with_votes(&email, p.items),
                        })
                        .map_err(|e| e.to_string()),
                },
                Request::Search { query, seq } => Response::Page {
                    seq,
                    result: client
                        .search_quotes(&query, 50)
                        .map(|p| FetchedPage {
                            page: 1,
                            total_pages: 1,
                            total_items: p.total_items,
                            quotes: client.enrich_with_votes(&email, p.items),
                        })
                        .map_err(|e| e.to_string()),
                },
                Request::Vote { quote_id, value } => Response::VoteDone {
                    result: client
                        .set_vote(&quote_id, &email, value)
                        .map_err(|e| e.to_string()),
                    quote_id,
                },
                Request::Submit { text } => Response::Submitted(
                    client
                        .submit_quote(&text, &email)
                        .map_err(|e| e.to_string()),
                ),
                Request::Update { quote_id, text } => Response::Updated {
                    result: client
                        .update_quote(&quote_id, &text)
                        .map_err(|e| e.to_string()),
                    quote_id,
                },
                Request::Delete { quote_id, short_id } => Response::Deleted {
                    result: client.delete_quote(&quote_id).map_err(|e| e.to_string()),
                    quote_id,
                    short_id,
                },
                // Slides the 180-day window; fails harmlessly for impersonation
                // tokens, which cannot be refreshed.
                Request::Refresh => {
                    Response::Refreshed(client.auth_refresh().ok().map(|a| a.token))
                }
                // Decides whether the edit/delete keys are offered, same as the
                // website's isAdmin check. Failure means "not an admin".
                Request::WhoAmI => Response::Admin(client.is_admin().unwrap_or(false)),
            };
            if res_tx.send(response).is_err() {
                break; // UI is gone
            }
        }
    });

    (req_tx, res_rx)
}
