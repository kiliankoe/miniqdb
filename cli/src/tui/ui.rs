//! Pure rendering: &App -> Frame. No state mutation besides the frame.

use ratatui::Frame;
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Clear, Paragraph};

use crate::api::Sort;
use crate::output::format_date;
use crate::tui::app::{App, Overlay};
use crate::tui::editor::Editor;

const ACCENT: Color = Color::Yellow;
const DOWN: Color = Color::Blue;
const WRAP_MARKER: &str = "↪ ";
const GUTTER: usize = 2;

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
        Overlay::Submit(editor) => {
            draw_editor(frame, editor, " new quote ", " ctrl-s submit · esc cancel ")
        }
        Overlay::Edit {
            short_id, editor, ..
        } => draw_editor(
            frame,
            editor,
            &format!(" edit #{short_id} "),
            " ctrl-s save · esc cancel ",
        ),
        Overlay::ConfirmDelete { short_id, .. } => draw_confirm_delete(frame, *short_id),
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
        None => {
            let mut hint = String::from(
                " j/k move · h/l page · [/] sort · u/d vote · enter open · s submit · / search",
            );
            if app.is_admin {
                hint.push_str(" · e edit · D delete");
            }
            hint.push_str(" · q quit");
            Line::from(hint).dim()
        }
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

fn draw_editor(frame: &mut Frame, editor: &Editor, title: &str, hint: &str) {
    let area = centered(frame.area(), 70, 40);
    frame.render_widget(Clear, area);
    let block = Block::bordered()
        .title(title)
        .title_bottom(Line::from(hint).right_aligned())
        .border_style(Style::new().fg(ACCENT));
    let inner = block.inner(area);
    frame.render_widget(block, area);

    // Gutter on the left for the wrap marker, one column on the right so the
    // cursor has somewhere to sit at the end of a full row.
    let width = (inner.width as usize).saturating_sub(GUTTER + 1).max(1);
    let (rows, (cursor_row, cursor_col)) = layout_editor(editor, width);

    let lines: Vec<Line> = rows
        .into_iter()
        .map(|(text, wrapped)| {
            let gutter = if wrapped {
                Span::styled(WRAP_MARKER, Style::new().fg(ACCENT).dim())
            } else {
                Span::raw("  ")
            };
            Line::from(vec![gutter, Span::raw(text)])
        })
        .collect();

    // Wrapping trades running off the right edge for running off the bottom,
    // so scroll to keep the cursor row in view.
    let offset = cursor_row.saturating_sub(inner.height.saturating_sub(1) as usize);
    frame.render_widget(Paragraph::new(lines).scroll((offset as u16, 0)), inner);
    frame.set_cursor_position((
        inner.x + (GUTTER + cursor_col) as u16,
        inner.y + (cursor_row - offset) as u16,
    ));
}

fn draw_confirm_delete(frame: &mut Frame, short_id: i64) {
    let area = centered(frame.area(), 60, 0);
    frame.render_widget(Clear, area);
    let block = Block::bordered()
        .title(" delete quote ")
        .border_style(Style::new().fg(ACCENT));
    let inner = block.inner(area);
    frame.render_widget(block, area);
    frame.render_widget(
        Paragraph::new(format!("Delete #{short_id}? This cannot be undone. [y/N]")).centered(),
        inner,
    );
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

/// One visual row of a wrapped editor buffer: display text, plus whether it is a
/// soft-wrap continuation of the row above rather than its own logical line.
type EditorRow = (String, bool);

/// Lay the editor buffer out into visual rows of at most `width` chars, and map the
/// cursor onto them. Wrapping is purely visual, the buffer keeps only the newlines
/// the user actually typed.
fn layout_editor(editor: &Editor, width: usize) -> (Vec<EditorRow>, (usize, usize)) {
    let mut rows = Vec::new();
    let mut cursor = (0, 0);

    for (row, line) in editor.lines.iter().enumerate() {
        for (i, (start, text)) in wrap_line(line, width).into_iter().enumerate() {
            // Segments are ordered and partition the line, so the last one
            // starting at or before the cursor is the one holding it.
            if row == editor.row && editor.col >= start {
                cursor = (rows.len(), (editor.col - start).min(width));
            }
            rows.push((text, i > 0));
        }
    }

    (rows, cursor)
}

/// Soft-wrap one logical line into `(start char offset, display text)` segments.
/// Segments partition the line: whitespace at a break belongs to the segment before
/// it and is trimmed from the display, so every cursor offset maps to exactly one
/// segment. Long words hard-break.
fn wrap_line(line: &str, width: usize) -> Vec<(usize, String)> {
    let width = width.max(1);
    let chars: Vec<char> = line.chars().collect();
    let mut out = Vec::new();
    let mut start = 0;

    while chars.len() - start > width {
        // Break after the last space that still fits, else mid-word.
        let limit = start + width;
        let brk = chars[start..=limit]
            .iter()
            .rposition(|c| c.is_whitespace())
            .map_or(limit, |i| start + i);
        out.push((start, chars[start..brk].iter().collect()));

        // The whitespace run at the break stays inside the segment we just pushed,
        // so its offsets don't fall into a gap between segments.
        start = brk;
        while start < chars.len() && chars[start].is_whitespace() {
            start += 1;
        }
    }
    out.push((start, chars[start..].iter().collect()));
    out
}

/// Greedy word wrap for display, dropping the offsets `wrap_line` tracks.
fn wrap(text: &str, width: usize) -> Vec<String> {
    let mut out: Vec<String> = text
        .lines()
        .flat_map(|line| wrap_line(line, width).into_iter().map(|(_, text)| text))
        .collect();
    if out.is_empty() {
        out.push(String::new());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::{layout_editor, wrap, wrap_line};
    use crate::tui::editor::Editor;

    #[test]
    fn wrap_preserves_short_lines_and_breaks_long_ones() {
        assert_eq!(wrap("ab cd\nef", 20), vec!["ab cd", "ef"]);
        assert_eq!(wrap("one two three", 7), vec!["one two", "three"]);
        assert_eq!(wrap("abcdefghij", 4), vec!["abcd", "efgh", "ij"]);
        assert_eq!(wrap("", 10), vec![""]);
    }

    #[test]
    fn wrap_line_reports_the_char_offset_each_segment_starts_at() {
        assert_eq!(
            wrap_line("one two three", 7),
            vec![(0, "one two".to_string()), (8, "three".to_string())]
        );
        assert_eq!(
            wrap_line("abcdefghij", 4),
            vec![
                (0, "abcd".to_string()),
                (4, "efgh".to_string()),
                (8, "ij".to_string())
            ]
        );
        assert_eq!(wrap_line("short", 10), vec![(0, "short".to_string())]);
        assert_eq!(wrap_line("", 10), vec![(0, String::new())]);
    }

    #[test]
    fn layout_editor_wraps_long_lines_and_marks_the_continuation() {
        let (rows, cursor) = layout_editor(&Editor::from_text("one two three"), 7);
        assert_eq!(
            rows,
            vec![("one two".to_string(), false), ("three".to_string(), true)]
        );
        assert_eq!(
            cursor,
            (1, 5),
            "cursor follows the text onto the wrapped row"
        );
    }

    #[test]
    fn layout_editor_maps_the_cursor_across_a_break() {
        let mut e = Editor::from_text("one two three");
        e.col = 7; // the space ending the first visual row
        assert_eq!(layout_editor(&e, 7).1, (0, 7));
        e.col = 8; // first char of "three"
        assert_eq!(layout_editor(&e, 7).1, (1, 0));
    }

    #[test]
    fn layout_editor_keeps_typed_newlines_separate_from_wraps() {
        let (rows, cursor) = layout_editor(&Editor::from_text("ab\ncd"), 7);
        assert_eq!(
            rows,
            vec![("ab".to_string(), false), ("cd".to_string(), false)]
        );
        assert_eq!(cursor, (1, 2));
    }
}
