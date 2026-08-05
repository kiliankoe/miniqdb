mod app;
mod editor;
mod ui;
mod worker;

use std::sync::mpsc::{Receiver, Sender};
use std::time::Duration;

use anyhow::Result;
use ratatui::DefaultTerminal;
use ratatui::crossterm::event::{self, Event, KeyEventKind};

use crate::api::{ApiError, jwt_expired};
use crate::config::Config;
use app::{App, Msg};
use worker::{Request, Response};

pub fn run() -> Result<()> {
    let config = Config::load_required()?;
    if jwt_expired(&config.token) {
        return Err(ApiError::Auth("stored auth token has expired".into()).into());
    }

    let (tx, rx) = worker::spawn(config.clone());
    let mut app = App::new(config.email.clone(), config.url.clone());

    // ratatui::init installs a panic hook that restores the terminal.
    let mut terminal = ratatui::init();
    let result = event_loop(&mut terminal, &mut app, &tx, &rx, config);
    ratatui::restore();
    result
}

fn event_loop(
    terminal: &mut DefaultTerminal,
    app: &mut App,
    tx: &Sender<Request>,
    rx: &Receiver<Response>,
    mut config: Config,
) -> Result<()> {
    loop {
        for request in app.take_pending() {
            tx.send(request)?;
        }
        if let Some(url) = app.take_open_url() {
            open_in_browser(&url);
        }
        terminal.draw(|frame| ui::draw(frame, app))?;
        if app.should_quit {
            return Ok(());
        }

        if event::poll(Duration::from_millis(100))?
            && let Event::Key(key) = event::read()?
            && key.kind != KeyEventKind::Release
        {
            app.update(Msg::Key(key));
        }
        while let Ok(response) = rx.try_recv() {
            if let Response::Refreshed(Some(token)) = &response {
                // Slide the 180-day window like the website does on load.
                config.token = token.clone();
                config.save().ok();
            }
            app.update(Msg::Worker(response));
        }
        app.tick();
    }
}

fn open_in_browser(url: &str) {
    #[cfg(target_os = "macos")]
    let opener = "open";
    #[cfg(not(target_os = "macos"))]
    let opener = "xdg-open";
    std::process::Command::new(opener)
        .arg(url)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .ok();
}
