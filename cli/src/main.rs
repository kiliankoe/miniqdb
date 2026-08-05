use clap::Parser;
use mqdb::api::ApiError;
use mqdb::cli::Cli;
use mqdb::config::NotLoggedIn;

fn main() {
    let cli = Cli::parse();
    if let Err(err) = mqdb::run(cli) {
        eprintln!("error: {err:#}");
        let auth_failure = err.is::<NotLoggedIn>()
            || matches!(err.downcast_ref::<ApiError>(), Some(ApiError::Auth(_)));
        std::process::exit(if auth_failure { 3 } else { 1 });
    }
}
