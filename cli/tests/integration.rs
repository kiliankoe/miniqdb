//! End-to-end tests against a real PocketBase running the repo's actual
//! migrations and hooks (shortId allocation, auto self-vote, score denorm).

mod harness;

use std::time::Duration;

use harness::TestPb;
use mqdb::api::{ApiError, Client, Sort};

// Sequential creates can land in the same millisecond; nudge them apart so
// `created`-based ordering is deterministic.
fn pause() {
    std::thread::sleep(Duration::from_millis(15));
}

#[test]
fn submit_allocates_short_id_and_auto_vote() {
    let pb = TestPb::start();
    let alice = pb.user_client("alice@example.com");

    let quote = alice
        .submit_quote("integration smoke quote", "alice@example.com")
        .unwrap();
    assert!(quote.short_id >= 1);

    let page = alice.list_quotes(Sort::Newest, 1, 10).unwrap();
    let fresh = page.items.iter().find(|q| q.id == quote.id).unwrap();
    assert_eq!(fresh.score, 1, "author auto-vote hook should have run");
}

#[test]
fn list_respects_sort_orders() {
    let pb = TestPb::start();
    let alice = pb.user_client("alice@example.com");
    let bob = pb.user_client("bob@example.com");

    let first = alice
        .submit_quote("ordering first", "alice@example.com")
        .unwrap();
    pause();
    let second = alice
        .submit_quote("ordering second", "alice@example.com")
        .unwrap();
    pause();
    let third = alice
        .submit_quote("ordering third", "alice@example.com")
        .unwrap();

    let newest = alice.list_quotes(Sort::Newest, 1, 10).unwrap();
    assert_eq!(newest.items[0].id, third.id);

    let oldest = alice.list_quotes(Sort::Oldest, 1, 10).unwrap();
    assert_eq!(oldest.items[0].id, first.id);

    bob.set_vote(&second.id, "bob@example.com", 1).unwrap();
    let top = alice.list_quotes(Sort::Top, 1, 10).unwrap();
    assert_eq!(top.items[0].id, second.id, "score 2 should rank first");
}

#[test]
fn vote_lifecycle_updates_score() {
    let pb = TestPb::start();
    let alice = pb.user_client("alice@example.com");
    let bob = pb.user_client("bob@example.com");

    let quote = alice
        .submit_quote("vote lifecycle quote", "alice@example.com")
        .unwrap();
    let score = |client: &Client| client.list_quotes(Sort::Newest, 1, 1).unwrap().items[0].score;
    assert_eq!(score(&alice), 1); // auto self-vote

    bob.set_vote(&quote.id, "bob@example.com", 1).unwrap();
    assert_eq!(score(&bob), 2);
    assert_eq!(
        bob.my_votes("bob@example.com", &[&quote.id]).unwrap()[0].value,
        1
    );

    bob.set_vote(&quote.id, "bob@example.com", -1).unwrap();
    assert_eq!(score(&bob), 0);
    assert_eq!(
        bob.my_votes("bob@example.com", &[&quote.id]).unwrap()[0].value,
        -1
    );

    bob.set_vote(&quote.id, "bob@example.com", 0).unwrap();
    assert_eq!(score(&bob), 1);
    assert!(
        bob.my_votes("bob@example.com", &[&quote.id])
            .unwrap()
            .is_empty()
    );
}

#[test]
fn enrichment_marks_own_votes() {
    let pb = TestPb::start();
    let alice = pb.user_client("alice@example.com");
    let bob = pb.user_client("bob@example.com");

    let voted = alice
        .submit_quote("enrichment voted quote", "alice@example.com")
        .unwrap();
    pause();
    alice
        .submit_quote("enrichment unvoted quote", "alice@example.com")
        .unwrap();
    bob.set_vote(&voted.id, "bob@example.com", 1).unwrap();

    let page = bob.list_quotes(Sort::Newest, 1, 10).unwrap();
    let enriched = bob.enrich_with_votes("bob@example.com", page.items);
    let vote_for = |text: &str| enriched.iter().find(|q| q.quote.text == text).unwrap().vote;
    assert_eq!(vote_for("enrichment voted quote"), 1);
    assert_eq!(vote_for("enrichment unvoted quote"), 0);
}

#[test]
fn search_escapes_quotes_and_backslashes() {
    let pb = TestPb::start();
    let alice = pb.user_client("alice@example.com");

    let tricky = r#"he said "hello \ world" loudly"#;
    alice.submit_quote(tricky, "alice@example.com").unwrap();
    alice
        .submit_quote("unrelated other quote", "alice@example.com")
        .unwrap();

    let found = alice.search_quotes(r#""hello \ world""#, 50).unwrap();
    assert_eq!(found.items.len(), 1);
    assert_eq!(found.items[0].text, tricky);
}

#[test]
fn mismatched_author_is_rejected() {
    let pb = TestPb::start();
    let alice = pb.user_client("alice@example.com");

    let err = alice
        .submit_quote("forged author quote", "someone-else@example.com")
        .unwrap_err();
    match err {
        ApiError::Api { status, .. } => assert_eq!(status, 400),
        other => panic!("expected 400 Api error, got {other:?}"),
    }
}

#[test]
fn invalid_token_is_an_auth_error() {
    let pb = TestPb::start();

    // List rules act as filters: anonymous requests get an empty 200, not 401.
    let anon = Client::new(&pb.url, None);
    assert!(
        anon.list_quotes(Sort::Newest, 1, 10)
            .unwrap()
            .items
            .is_empty()
    );

    // Guarded endpoints do reject bad tokens; auth_refresh is what surfaces it.
    let stale = Client::new(&pb.url, Some("invalid-token".into()));
    let err = stale.auth_refresh().unwrap_err();
    assert!(matches!(err, ApiError::Auth(_)), "got {err:?}");
}
