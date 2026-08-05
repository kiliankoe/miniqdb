//! Pure rendering: &App -> Frame. No state mutation besides the frame.

use ratatui::Frame;
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Clear, Paragraph};

use crate::api::Sort;
use crate::output::format_date;
use crate::tui::app::{App, Overlay};

const ACCENT: Color = Color::Yellow;
const DOWN: Color = Color::Blue;

pub fn draw(frame: &mut Frame, app: &App) {
    let [header, body, status] = Layout::vertical([
        Constraint::Length(1),
        Constraint::Min(0),
        Constraint::Length(1),
    ])
    .areas(frame.area());

    draw_header(frame, app, header);
    draw_quotes(frame, app, body);
    draw_status(frame, app, status);

    match &app.overlay {
        Overlay::None => {}
        Overlay::Submit(editor) => draw_submit(frame, editor),
        Overlay::SearchInput(query) => draw_search_input(frame, query),
    }
}

fn draw_header(frame: &mut Frame, app: &App, area: Rect) {
    let mut spans = vec![Span::styled(" miniqdb ", Style::new().bold())];
    match &app.search {
        Some(query) => spans.push(Span::styled(
            format!(" #search \"{query}\""),
            Style::new().fg(ACCENT).bold(),
        )),
        None => {
            for sort in [Sort::Newest, Sort::Top, Sort::Random] {
                let style = if sort == app.sort {
                    Style::new().fg(ACCENT).bold()
                } else {
                    Style::new().dim()
                };
                spans.push(Span::styled(format!(" {} ", sort.label()), style));
            }
        }
    }
    frame.render_widget(Line::from(spans), area);

    let email = Line::from(format!("{} ", app.email)).right_aligned().dim();
    frame.render_widget(email, area);
}

fn draw_quotes(frame: &mut Frame, app: &App, area: Rect) {
    if app.quotes.is_empty() {
        let hint = if app.loading {
            "loading…"
        } else {
            "no quotes"
        };
        frame.render_widget(Paragraph::new(hint).dim().centered(), area);
        return;
    }

    let width = area.width.saturating_sub(4).max(10) as usize;
    let mut lines: Vec<Line> = Vec::new();
    let mut selected_range = (0usize, 0usize);

    for (i, q) in app.quotes.iter().enumerate() {
        let selected = i == app.selected;
        if i > 0 {
            lines.push(Line::default());
        }
        let start = lines.len();

        let prefix = if selected { "▸ " } else { "  " };
        let header_style = if selected {
            Style::new().fg(ACCENT).bold()
        } else {
            Style::new().add_modifier(Modifier::DIM)
        };
        let mut header = vec![
            Span::raw(prefix),
            Span::styled(
                format!(
                    "#{} · {} · {}",
                    q.quote.short_id,
                    format_date(&q.quote.created),
                    q.quote.score
                ),
                header_style,
            ),
        ];
        match q.vote {
            1 => header.push(Span::styled(" ▲", Style::new().fg(ACCENT))),
            -1 => header.push(Span::styled(" ▼", Style::new().fg(DOWN))),
            _ => {}
        }
        lines.push(Line::from(header));

        let text_style = if selected {
            Style::new()
        } else {
            Style::new().add_modifier(Modifier::DIM)
        };
        for wrapped in wrap(&q.quote.text, width) {
            lines.push(Line::from(Span::styled(
                format!("    {wrapped}"),
                text_style,
            )));
        }

        if selected {
            selected_range = (start, lines.len());
        }
    }

    // Scroll just enough to keep the selected quote fully visible.
    let height = area.height as usize;
    let mut offset = 0usize;
    if selected_range.1 > height {
        offset = selected_range.1 - height;
    }
    offset = offset.min(selected_range.0);

    frame.render_widget(Paragraph::new(lines).scroll((offset as u16, 0)), area);
}

fn draw_status(frame: &mut Frame, app: &App, area: Rect) {
    let left = match &app.status {
        Some((message, _)) => Line::from(format!(" {message}")).fg(ACCENT),
        None => Line::from(" j/k move · tab sort · u/d vote · s submit · / search · q quit").dim(),
    };
    frame.render_widget(left, area);

    let mut right = String::new();
    if app.loading {
        right.push_str("loading… ");
    }
    if app.search.is_some() {
        right.push_str(&format!("{} results ", app.total_items));
    } else if app.sort != Sort::Random && app.total_pages > 1 {
        right.push_str(&format!("page {}/{} ", app.page, app.total_pages));
    }
    if !right.is_empty() {
        frame.render_widget(Line::from(right).right_aligned().dim(), area);
    }
}

fn draw_submit(frame: &mut Frame, editor: &crate::tui::editor::Editor) {
    let area = centered(frame.area(), 70, 40);
    frame.render_widget(Clear, area);
    let block = Block::bordered()
        .title(" new quote ")
        .title_bottom(Line::from(" ctrl-s submit · esc cancel ").right_aligned())
        .border_style(Style::new().fg(ACCENT));
    let inner = block.inner(area);
    frame.render_widget(block, area);
    frame.render_widget(Paragraph::new(editor.text()), inner);
    frame.set_cursor_position((
        inner.x + editor.col.min(inner.width.saturating_sub(1) as usize) as u16,
        inner.y + editor.row.min(inner.height.saturating_sub(1) as usize) as u16,
    ));
}

fn draw_search_input(frame: &mut Frame, query: &str) {
    let area = centered(frame.area(), 60, 0);
    frame.render_widget(Clear, area);
    let block = Block::bordered()
        .title(" search ")
        .title_bottom(Line::from(" enter run · esc cancel ").right_aligned())
        .border_style(Style::new().fg(ACCENT));
    let inner = block.inner(area);
    frame.render_widget(block, area);
    frame.render_widget(Paragraph::new(query), inner);
    frame.set_cursor_position((inner.x + query.chars().count() as u16, inner.y));
}

fn centered(area: Rect, percent_x: u16, percent_y: u16) -> Rect {
    let height = if percent_y == 0 {
        3
    } else {
        (area.height * percent_y / 100).max(5)
    };
    let width = (area.width * percent_x / 100).max(20);
    Rect {
        x: area.x + (area.width.saturating_sub(width)) / 2,
        y: area.y + (area.height.saturating_sub(height)) / 2,
        width: width.min(area.width),
        height: height.min(area.height),
    }
}

/// Greedy word wrap; long words hard-break. Char-count based (close enough
/// for terminal width in practice).
fn wrap(text: &str, width: usize) -> Vec<String> {
    let mut out = Vec::new();
    for raw in text.lines() {
        if raw.chars().count() <= width {
            out.push(raw.to_string());
            continue;
        }
        let mut current = String::new();
        for word in raw.split_whitespace() {
            let word_len = word.chars().count();
            let current_len = current.chars().count();
            if !current.is_empty() && current_len + 1 + word_len > width {
                out.push(std::mem::take(&mut current));
            }
            if word_len > width {
                for c in word.chars() {
                    if current.chars().count() == width {
                        out.push(std::mem::take(&mut current));
                    }
                    current.push(c);
                }
            } else {
                if !current.is_empty() {
                    current.push(' ');
                }
                current.push_str(word);
            }
        }
        if !current.is_empty() {
            out.push(current);
        }
    }
    if out.is_empty() {
        out.push(String::new());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::wrap;

    #[test]
    fn wrap_preserves_short_lines_and_breaks_long_ones() {
        assert_eq!(wrap("ab cd\nef", 20), vec!["ab cd", "ef"]);
        assert_eq!(wrap("one two three", 7), vec!["one two", "three"]);
        assert_eq!(wrap("abcdefghij", 4), vec!["abcd", "efgh", "ij"]);
        assert_eq!(wrap("", 10), vec![""]);
    }
}
