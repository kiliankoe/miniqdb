//! TUI state machine. `update` is pure (mutates App, pushes outgoing requests
//! into `pending`) so behavior is testable without a terminal or network.

use std::collections::HashMap;
use std::time::{Duration, Instant};

use ratatui::crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

use crate::api::{QuoteWithVote, Sort};
use crate::tui::editor::Editor;
use crate::tui::worker::{Request, Response};

const STATUS_TTL: Duration = Duration::from_secs(3);
const POLL_INTERVAL: Duration = Duration::from_secs(60);
// Tab order mirrors the website's nav: #latest, #top, #random.
const TABS: [Sort; 3] = [Sort::Newest, Sort::Top, Sort::Random];

pub enum Msg {
    Key(KeyEvent),
    Worker(Response),
}

#[derive(Debug)]
pub enum Overlay {
    None,
    Submit(Editor),
    SearchInput(String),
}

pub struct App {
    pub email: String,
    base_url: String,
    pub sort: Sort,
    /// `Some(query)` while showing search results instead of the sorted list.
    pub search: Option<String>,
    pub overlay: Overlay,
    pub quotes: Vec<QuoteWithVote>,
    pub selected: usize,
    pub page: u32,
    pub total_pages: i64,
    pub total_items: i64,
    pub loading: bool,
    pub submitting: bool,
    pub status: Option<(String, Instant)>,
    pub should_quit: bool,
    seq: u64,
    last_fetch: Instant,
    /// Optimistically-applied votes awaiting server confirmation:
    /// quote id → (previous vote, previous score) for rollback.
    pending_votes: HashMap<String, (i64, i64)>,
    pending: Vec<Request>,
    /// URL waiting to be opened in the browser (side effect owned by the event loop).
    pending_open: Option<String>,
}

impl App {
    pub fn new(email: String, base_url: String) -> Self {
        let mut app = App {
            email,
            base_url,
            sort: Sort::Newest,
            search: None,
            overlay: Overlay::None,
            quotes: Vec::new(),
            selected: 0,
            page: 1,
            total_pages: 1,
            total_items: 0,
            loading: false,
            submitting: false,
            status: None,
            should_quit: false,
            seq: 0,
            last_fetch: Instant::now(),
            pending_votes: HashMap::new(),
            pending: Vec::new(),
            pending_open: None,
        };
        app.pending.push(Request::Refresh);
        app.request_fetch();
        app
    }

    pub fn take_pending(&mut self) -> Vec<Request> {
        std::mem::take(&mut self.pending)
    }

    pub fn take_open_url(&mut self) -> Option<String> {
        self.pending_open.take()
    }

    /// Called every event-loop iteration: expires transient status messages
    /// and keeps the #latest view fresh via idle polling.
    pub fn tick(&mut self) {
        if let Some((_, since)) = &self.status
            && since.elapsed() > STATUS_TTL
        {
            self.status = None;
        }
        if self.poll_due() {
            self.request_fetch();
        }
    }

    /// Only #latest auto-refreshes: random would reshuffle under the user and
    /// search/top change too rarely to matter. Held back while a fetch or an
    /// optimistic vote is in flight so stale data can't overwrite it.
    fn poll_due(&self) -> bool {
        self.search.is_none()
            && self.sort == Sort::Newest
            && !self.loading
            && self.pending_votes.is_empty()
            && self.last_fetch.elapsed() >= POLL_INTERVAL
    }

    fn set_status(&mut self, message: impl Into<String>) {
        self.status = Some((message.into(), Instant::now()));
    }

    fn request_fetch(&mut self) {
        self.seq += 1;
        self.loading = true;
        self.last_fetch = Instant::now();
        match &self.search {
            Some(query) => self.pending.push(Request::Search {
                query: query.clone(),
                seq: self.seq,
            }),
            None => self.pending.push(Request::Fetch {
                sort: self.sort,
                page: self.page,
                limit: 10,
                seq: self.seq,
            }),
        }
    }

    pub fn update(&mut self, msg: Msg) {
        match msg {
            Msg::Key(key) => self.on_key(key),
            Msg::Worker(response) => self.on_response(response),
        }
    }

    fn on_key(&mut self, key: KeyEvent) {
        if key.modifiers.contains(KeyModifiers::CONTROL) && key.code == KeyCode::Char('c') {
            self.should_quit = true;
            return;
        }
        match &mut self.overlay {
            Overlay::Submit(_) => self.on_submit_key(key),
            Overlay::SearchInput(_) => self.on_search_input_key(key),
            Overlay::None => self.on_list_key(key),
        }
    }

    fn on_submit_key(&mut self, key: KeyEvent) {
        let Overlay::Submit(editor) = &mut self.overlay else {
            return;
        };
        match (key.code, key.modifiers) {
            (KeyCode::Esc, _) => self.overlay = Overlay::None,
            (KeyCode::Char('s'), m) if m.contains(KeyModifiers::CONTROL) => {
                if self.submitting {
                    return;
                }
                let text = editor.text().trim().to_string();
                if text.chars().count() < 5 {
                    self.set_status("quote must be at least 5 characters");
                    return;
                }
                self.submitting = true;
                self.pending.push(Request::Submit { text });
                self.set_status("submitting…");
            }
            (KeyCode::Enter, _) => editor.newline(),
            (KeyCode::Backspace, _) => editor.backspace(),
            (KeyCode::Left, _) => editor.move_left(),
            (KeyCode::Right, _) => editor.move_right(),
            (KeyCode::Up, _) => editor.move_up(),
            (KeyCode::Down, _) => editor.move_down(),
            (KeyCode::Char(c), m) if !m.contains(KeyModifiers::CONTROL) => editor.insert_char(c),
            _ => {}
        }
    }

    fn on_search_input_key(&mut self, key: KeyEvent) {
        let Overlay::SearchInput(query) = &mut self.overlay else {
            return;
        };
        match key.code {
            KeyCode::Esc => self.overlay = Overlay::None,
            KeyCode::Enter => {
                let query = query.trim().to_string();
                // Same minimum length the website's search enables at.
                if query.chars().count() >= 2 {
                    self.overlay = Overlay::None;
                    self.search = Some(query);
                    self.selected = 0;
                    self.request_fetch();
                }
            }
            KeyCode::Backspace => {
                query.pop();
            }
            KeyCode::Char(c) if !key.modifiers.contains(KeyModifiers::CONTROL) => query.push(c),
            _ => {}
        }
    }

    fn on_list_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Char('q') => self.should_quit = true,
            KeyCode::Esc if self.search.is_some() => {
                self.search = None;
                self.selected = 0;
                self.request_fetch();
            }
            KeyCode::Char('[') | KeyCode::Char(']') if self.search.is_none() => {
                let idx = TABS.iter().position(|s| *s == self.sort).unwrap_or(0);
                let next = if key.code == KeyCode::Char(']') {
                    (idx + 1) % TABS.len()
                } else {
                    (idx + TABS.len() - 1) % TABS.len()
                };
                self.sort = TABS[next];
                self.page = 1;
                self.selected = 0;
                self.request_fetch();
            }
            KeyCode::Char('j') | KeyCode::Down => {
                if self.selected + 1 < self.quotes.len() {
                    self.selected += 1;
                }
            }
            KeyCode::Char('k') | KeyCode::Up => {
                self.selected = self.selected.saturating_sub(1);
            }
            KeyCode::Char('g') => self.selected = 0,
            KeyCode::Char('G') => self.selected = self.quotes.len().saturating_sub(1),
            KeyCode::Char('l') | KeyCode::Right | KeyCode::Char('n') => self.turn_page(1),
            KeyCode::Char('h') | KeyCode::Left | KeyCode::Char('p') => self.turn_page(-1),
            KeyCode::Char('u') => self.vote_toggle(1),
            KeyCode::Char('d') => self.vote_toggle(-1),
            KeyCode::Char('x') => self.vote_set(0),
            KeyCode::Char('r') => self.request_fetch(),
            KeyCode::Enter => self.open_selected(),
            KeyCode::Char('s') => self.overlay = Overlay::Submit(Editor::new()),
            KeyCode::Char('/') => self.overlay = Overlay::SearchInput(String::new()),
            _ => {}
        }
    }

    fn paged(&self) -> bool {
        self.search.is_none() && self.sort != Sort::Random
    }

    fn turn_page(&mut self, delta: i64) {
        if !self.paged() {
            return;
        }
        let target = (self.page as i64 + delta).clamp(1, self.total_pages.max(1));
        if target != self.page as i64 {
            self.page = target as u32;
            self.selected = 0;
            self.request_fetch();
        }
    }

    /// The quote detail page lives at `<base-url>/<shortId>` (same link the
    /// webhook notifications use).
    fn open_selected(&mut self) {
        let Some(quote) = self.quotes.get(self.selected) else {
            return;
        };
        let short_id = quote.quote.short_id;
        self.pending_open = Some(format!("{}/{short_id}", self.base_url));
        self.set_status(format!("opening #{short_id} in browser"));
    }

    /// Website toggle semantics: pressing the direction you already voted clears.
    fn vote_toggle(&mut self, direction: i64) {
        let Some(current) = self.quotes.get(self.selected).map(|q| q.vote) else {
            return;
        };
        let new = if current == direction { 0 } else { direction };
        self.vote_set(new);
    }

    fn vote_set(&mut self, new: i64) {
        let Some(quote) = self.quotes.get_mut(self.selected) else {
            return;
        };
        if quote.vote == new || self.pending_votes.contains_key(&quote.quote.id) {
            // Unchanged, or a vote for this quote is already in flight (rapid
            // find-then-write calls would race the unique index server-side).
            return;
        }
        self.pending_votes
            .insert(quote.quote.id.clone(), (quote.vote, quote.quote.score));
        // Same optimistic arithmetic as useVote's onMutate.
        quote.quote.score += new - quote.vote;
        quote.vote = new;
        self.pending.push(Request::Vote {
            quote_id: quote.quote.id.clone(),
            value: new,
        });
    }

    fn on_response(&mut self, response: Response) {
        match response {
            Response::Page { seq, result } => {
                if seq != self.seq {
                    return; // stale
                }
                self.loading = false;
                match result {
                    Ok(fetched) => {
                        self.quotes = fetched.quotes;
                        self.page = fetched.page;
                        self.total_pages = fetched.total_pages;
                        self.total_items = fetched.total_items;
                        self.selected = self.selected.min(self.quotes.len().saturating_sub(1));
                    }
                    Err(err) => self.set_status(format!("load failed: {err}")),
                }
            }
            Response::VoteDone { quote_id, result } => {
                let previous = self.pending_votes.remove(&quote_id);
                if let Err(err) = result {
                    // Roll back the optimistic update if the quote is still visible.
                    if let (Some((vote, score)), Some(quote)) = (
                        previous,
                        self.quotes.iter_mut().find(|q| q.quote.id == quote_id),
                    ) {
                        quote.vote = vote;
                        quote.quote.score = score;
                    }
                    self.set_status(format!("vote failed: {err}"));
                }
            }
            Response::Submitted(result) => {
                self.submitting = false;
                match result {
                    Ok(quote) => {
                        self.overlay = Overlay::None;
                        self.set_status(format!("Submitted #{}", quote.short_id));
                        // Make it show up right away where it would appear.
                        if self.search.is_none() && self.sort == Sort::Newest && self.page == 1 {
                            self.request_fetch();
                        }
                    }
                    Err(err) => self.set_status(format!("submit failed: {err}")),
                }
            }
            // Persisting the refreshed token is handled by the event loop.
            Response::Refreshed(_) => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::Quote;
    use crate::tui::worker::FetchedPage;

    fn key(code: KeyCode) -> Msg {
        Msg::Key(KeyEvent::new(code, KeyModifiers::NONE))
    }

    fn ctrl(c: char) -> Msg {
        Msg::Key(KeyEvent::new(KeyCode::Char(c), KeyModifiers::CONTROL))
    }

    fn quote(id: &str, score: i64, vote: i64) -> QuoteWithVote {
        QuoteWithVote {
            quote: Quote {
                id: id.into(),
                text: format!("text of {id}"),
                author: "a@example.com".into(),
                short_id: 1,
                score,
                created: "2026-08-05 10:00:00.000Z".into(),
                updated: "2026-08-05 10:00:00.000Z".into(),
            },
            vote,
        }
    }

    fn app_with_quotes(quotes: Vec<QuoteWithVote>) -> App {
        let mut app = App::new("me@example.com".into(), "https://q.example.com".into());
        app.take_pending();
        app.quotes = quotes;
        app.total_pages = 3;
        app.total_items = 25;
        app.loading = false;
        app
    }

    #[test]
    fn brackets_cycle_sorts_and_reset_page() {
        let mut app = app_with_quotes(vec![quote("q1", 1, 0)]);
        app.page = 2;
        app.selected = 0;
        app.update(key(KeyCode::Char(']')));
        assert_eq!(app.sort, Sort::Top);
        assert_eq!(app.page, 1);
        assert!(matches!(
            app.take_pending().as_slice(),
            [Request::Fetch {
                sort: Sort::Top,
                page: 1,
                ..
            }]
        ));
        app.update(key(KeyCode::Char(']')));
        assert_eq!(app.sort, Sort::Random);
        app.update(key(KeyCode::Char(']')));
        assert_eq!(app.sort, Sort::Newest);
        app.update(key(KeyCode::Char('[')));
        assert_eq!(app.sort, Sort::Random);
    }

    #[test]
    fn navigation_clamps_to_bounds() {
        let mut app = app_with_quotes(vec![quote("q1", 1, 0), quote("q2", 1, 0)]);
        app.update(key(KeyCode::Char('k')));
        assert_eq!(app.selected, 0);
        app.update(key(KeyCode::Char('j')));
        assert_eq!(app.selected, 1);
        app.update(key(KeyCode::Char('j')));
        assert_eq!(app.selected, 1);
        app.update(key(KeyCode::Char('g')));
        assert_eq!(app.selected, 0);
        app.update(key(KeyCode::Char('G')));
        assert_eq!(app.selected, 1);
    }

    #[test]
    fn upvote_toggles_and_is_optimistic() {
        let mut app = app_with_quotes(vec![quote("q1", 3, 0)]);
        app.update(key(KeyCode::Char('u')));
        assert_eq!(app.quotes[0].vote, 1);
        assert_eq!(app.quotes[0].quote.score, 4);
        assert!(matches!(
            app.take_pending().as_slice(),
            [Request::Vote { value: 1, .. }]
        ));

        // Same direction again while pending → ignored (in-flight guard).
        app.update(key(KeyCode::Char('u')));
        assert!(app.take_pending().is_empty());

        // Server confirms; toggling now clears the vote.
        app.update(Msg::Worker(Response::VoteDone {
            quote_id: "q1".into(),
            result: Ok(()),
        }));
        app.update(key(KeyCode::Char('u')));
        assert_eq!(app.quotes[0].vote, 0);
        assert_eq!(app.quotes[0].quote.score, 3);
        assert!(matches!(
            app.take_pending().as_slice(),
            [Request::Vote { value: 0, .. }]
        ));
    }

    #[test]
    fn failed_vote_rolls_back() {
        let mut app = app_with_quotes(vec![quote("q1", 3, 0)]);
        app.update(key(KeyCode::Char('d')));
        assert_eq!(app.quotes[0].quote.score, 2);
        app.update(Msg::Worker(Response::VoteDone {
            quote_id: "q1".into(),
            result: Err("boom".into()),
        }));
        assert_eq!(app.quotes[0].vote, 0);
        assert_eq!(app.quotes[0].quote.score, 3);
        assert!(app.status.as_ref().unwrap().0.contains("vote failed"));
    }

    #[test]
    fn page_turning_clamps_and_fetches() {
        let mut app = app_with_quotes(vec![quote("q1", 1, 0)]);
        app.update(key(KeyCode::Char('h')));
        assert_eq!(app.page, 1); // clamped at 1
        assert!(app.take_pending().is_empty());
        app.update(key(KeyCode::Char('l')));
        assert_eq!(app.page, 2);
        assert!(matches!(
            app.take_pending().as_slice(),
            [Request::Fetch { page: 2, .. }]
        ));
    }

    #[test]
    fn random_sort_does_not_page() {
        let mut app = app_with_quotes(vec![quote("q1", 1, 0)]);
        app.sort = Sort::Random;
        app.update(key(KeyCode::Char('l')));
        assert_eq!(app.page, 1);
        assert!(app.take_pending().is_empty());
    }

    #[test]
    fn stale_page_responses_are_dropped() {
        let mut app = app_with_quotes(vec![quote("q1", 1, 0)]);
        app.update(key(KeyCode::Char('r'))); // seq bumps
        app.take_pending();
        app.update(Msg::Worker(Response::Page {
            seq: 0, // stale
            result: Ok(FetchedPage {
                page: 9,
                total_pages: 9,
                total_items: 9,
                quotes: vec![],
            }),
        }));
        assert_eq!(app.page, 1);
        assert!(!app.quotes.is_empty());
    }

    #[test]
    fn submit_overlay_captures_typing_and_submits() {
        let mut app = app_with_quotes(vec![quote("q1", 1, 0)]);
        app.update(key(KeyCode::Char('s')));
        assert!(matches!(app.overlay, Overlay::Submit(_)));

        // 'q' must reach the editor, not quit the app.
        for c in "quote!".chars() {
            app.update(key(KeyCode::Char(c)));
        }
        assert!(!app.should_quit);

        app.update(ctrl('s'));
        assert!(app.submitting);
        assert!(
            matches!(app.take_pending().as_slice(), [Request::Submit { text }] if text == "quote!")
        );

        app.update(Msg::Worker(Response::Submitted(Ok(
            quote("new", 1, 1).quote
        ))));
        assert!(matches!(app.overlay, Overlay::None));
        assert!(matches!(
            app.take_pending().as_slice(),
            [Request::Fetch { .. }]
        ));
    }

    #[test]
    fn short_submissions_are_rejected_locally() {
        let mut app = app_with_quotes(vec![]);
        app.update(key(KeyCode::Char('s')));
        app.update(key(KeyCode::Char('h')));
        app.update(key(KeyCode::Char('i')));
        app.update(ctrl('s'));
        assert!(!app.submitting);
        assert!(app.take_pending().is_empty());
        assert!(matches!(app.overlay, Overlay::Submit(_)));
    }

    #[test]
    fn search_flow_and_escape_back() {
        let mut app = app_with_quotes(vec![quote("q1", 1, 0)]);
        app.update(key(KeyCode::Char('/')));
        app.update(key(KeyCode::Char('a')));
        app.update(key(KeyCode::Enter)); // 1 char — below minimum, stays open
        assert!(matches!(app.overlay, Overlay::SearchInput(_)));
        app.update(key(KeyCode::Char('b')));
        app.update(key(KeyCode::Enter));
        assert_eq!(app.search.as_deref(), Some("ab"));
        assert!(
            matches!(app.take_pending().as_slice(), [Request::Search { query, .. }] if query == "ab")
        );

        app.update(key(KeyCode::Esc));
        assert!(app.search.is_none());
        assert!(matches!(
            app.take_pending().as_slice(),
            [Request::Fetch { .. }]
        ));
    }

    #[test]
    fn enter_yields_the_quote_detail_url() {
        let mut app = app_with_quotes(vec![quote("q1", 1, 0)]);
        app.update(key(KeyCode::Enter));
        assert_eq!(
            app.take_open_url().as_deref(),
            Some("https://q.example.com/1")
        );
        assert!(app.take_open_url().is_none(), "taken only once");

        let mut app = app_with_quotes(vec![]);
        app.update(key(KeyCode::Enter));
        assert!(app.take_open_url().is_none(), "no selection, no URL");
    }

    #[test]
    fn idle_poll_refetches_latest_after_interval() {
        let mut app = app_with_quotes(vec![quote("q1", 1, 0)]);
        app.tick();
        assert!(app.take_pending().is_empty(), "not due yet");

        // CI/dev machines are up for well over a minute, so this cannot underflow.
        app.last_fetch = Instant::now().checked_sub(POLL_INTERVAL).unwrap();
        app.tick();
        assert!(matches!(
            app.take_pending().as_slice(),
            [Request::Fetch {
                sort: Sort::Newest,
                ..
            }]
        ));
        // The fetch reset the timer and set loading, so it doesn't refire.
        app.tick();
        assert!(app.take_pending().is_empty());
    }

    #[test]
    fn idle_poll_only_runs_on_the_latest_view() {
        let overdue = Instant::now().checked_sub(POLL_INTERVAL).unwrap();

        let mut app = app_with_quotes(vec![quote("q1", 1, 0)]);
        app.sort = Sort::Random;
        app.last_fetch = overdue;
        app.tick();
        assert!(app.take_pending().is_empty(), "random must not reshuffle");

        let mut app = app_with_quotes(vec![quote("q1", 1, 0)]);
        app.search = Some("query".into());
        app.last_fetch = overdue;
        app.tick();
        assert!(
            app.take_pending().is_empty(),
            "search results are not polled"
        );

        // An in-flight optimistic vote defers the poll.
        let mut app = app_with_quotes(vec![quote("q1", 1, 0)]);
        app.update(key(KeyCode::Char('u')));
        app.take_pending();
        app.last_fetch = overdue;
        app.tick();
        assert!(app.take_pending().is_empty(), "pending vote defers polling");
    }

    #[test]
    fn quit_keys() {
        let mut app = app_with_quotes(vec![]);
        app.update(key(KeyCode::Char('q')));
        assert!(app.should_quit);

        let mut app = app_with_quotes(vec![]);
        app.update(ctrl('c'));
        assert!(app.should_quit);
    }
}
