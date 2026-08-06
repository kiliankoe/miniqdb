//! Minimal multiline text editor for the submit overlay. Column positions are
//! in characters, converted to byte offsets only at mutation time.

#[derive(Debug, Default)]
pub struct Editor {
    pub lines: Vec<String>,
    pub row: usize,
    pub col: usize,
}

fn byte_index(line: &str, col: usize) -> usize {
    line.char_indices()
        .nth(col)
        .map(|(i, _)| i)
        .unwrap_or(line.len())
}

fn char_len(line: &str) -> usize {
    line.chars().count()
}

impl Editor {
    pub fn new() -> Self {
        Editor {
            lines: vec![String::new()],
            row: 0,
            col: 0,
        }
    }

    /// Seed the editor with existing text, cursor at the end.
    pub fn from_text(text: &str) -> Self {
        let lines: Vec<String> = text.split('\n').map(String::from).collect();
        let row = lines.len() - 1;
        let col = char_len(&lines[row]);
        Editor { lines, row, col }
    }

    pub fn text(&self) -> String {
        self.lines.join("\n")
    }

    pub fn insert_char(&mut self, c: char) {
        let line = &mut self.lines[self.row];
        line.insert(byte_index(line, self.col), c);
        self.col += 1;
    }

    pub fn newline(&mut self) {
        let line = &mut self.lines[self.row];
        let rest = line.split_off(byte_index(line, self.col));
        self.lines.insert(self.row + 1, rest);
        self.row += 1;
        self.col = 0;
    }

    pub fn backspace(&mut self) {
        if self.col > 0 {
            let line = &mut self.lines[self.row];
            let idx = byte_index(line, self.col - 1);
            line.remove(idx);
            self.col -= 1;
        } else if self.row > 0 {
            let removed = self.lines.remove(self.row);
            self.row -= 1;
            self.col = char_len(&self.lines[self.row]);
            self.lines[self.row].push_str(&removed);
        }
    }

    pub fn move_left(&mut self) {
        if self.col > 0 {
            self.col -= 1;
        } else if self.row > 0 {
            self.row -= 1;
            self.col = char_len(&self.lines[self.row]);
        }
    }

    pub fn move_right(&mut self) {
        if self.col < char_len(&self.lines[self.row]) {
            self.col += 1;
        } else if self.row + 1 < self.lines.len() {
            self.row += 1;
            self.col = 0;
        }
    }

    pub fn move_up(&mut self) {
        if self.row > 0 {
            self.row -= 1;
            self.col = self.col.min(char_len(&self.lines[self.row]));
        }
    }

    pub fn move_down(&mut self) {
        if self.row + 1 < self.lines.len() {
            self.row += 1;
            self.col = self.col.min(char_len(&self.lines[self.row]));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn editor_with(text: &str) -> Editor {
        let mut e = Editor::new();
        for c in text.chars() {
            if c == '\n' {
                e.newline();
            } else {
                e.insert_char(c);
            }
        }
        e
    }

    #[test]
    fn inserts_and_reads_back() {
        let e = editor_with("hello\nworld");
        assert_eq!(e.text(), "hello\nworld");
        assert_eq!((e.row, e.col), (1, 5));
    }

    #[test]
    fn from_text_seeds_the_buffer_with_the_cursor_at_the_end() {
        let e = Editor::from_text("ab\ncd");
        assert_eq!(e.text(), "ab\ncd");
        assert_eq!((e.row, e.col), (1, 2));

        let e = Editor::from_text("");
        assert_eq!(e.text(), "");
        assert_eq!((e.row, e.col), (0, 0));
    }

    #[test]
    fn newline_splits_the_current_line() {
        let mut e = editor_with("abcd");
        e.move_left();
        e.move_left();
        e.newline();
        assert_eq!(e.text(), "ab\ncd");
        assert_eq!((e.row, e.col), (1, 0));
    }

    #[test]
    fn backspace_joins_lines_at_start_of_line() {
        let mut e = editor_with("ab\ncd");
        e.row = 1;
        e.col = 0;
        e.backspace();
        assert_eq!(e.text(), "abcd");
        assert_eq!((e.row, e.col), (0, 2));
    }

    #[test]
    fn handles_multibyte_characters() {
        let mut e = editor_with("äöü");
        e.backspace();
        assert_eq!(e.text(), "äö");
        e.move_left();
        e.insert_char('ß');
        assert_eq!(e.text(), "äßö");
    }

    #[test]
    fn vertical_motion_clamps_column() {
        let mut e = editor_with("long line\nab");
        assert_eq!((e.row, e.col), (1, 2));
        e.move_up();
        assert_eq!((e.row, e.col), (0, 2));
        e.move_down();
        assert_eq!((e.row, e.col), (1, 2));
    }
}
