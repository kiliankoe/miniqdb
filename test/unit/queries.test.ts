import { describe, expect, it } from "vitest";
import { escapeFilterString, getSortString, parseShortId } from "@/lib/queries";

describe("getSortString", () => {
  it("maps each sort to its PocketBase sort expression", () => {
    expect(getSortString("newest")).toBe("-created");
    expect(getSortString("oldest")).toBe("+created");
    expect(getSortString("top")).toBe("-score,-created");
    expect(getSortString("random")).toBe("@random");
  });
});

describe("parseShortId", () => {
  it("parses positive integers", () => {
    expect(parseShortId("1")).toBe(1);
    expect(parseShortId("4823")).toBe(4823);
  });

  it("rejects non-numeric input instead of passing it into the filter", () => {
    expect(parseShortId("abc")).toBeNull();
    expect(parseShortId('1 || id != ""')).toBeNull();
    expect(parseShortId("12abc")).toBeNull();
  });

  it("rejects zero, negatives, fractions, and empty input", () => {
    expect(parseShortId("0")).toBeNull();
    expect(parseShortId("-3")).toBeNull();
    expect(parseShortId("1.5")).toBeNull();
    expect(parseShortId("")).toBeNull();
  });
});

describe("escapeFilterString", () => {
  it("leaves plain text untouched", () => {
    expect(escapeFilterString("hello world")).toBe("hello world");
  });

  it("escapes double quotes", () => {
    expect(escapeFilterString('say "hi"')).toBe('say \\"hi\\"');
  });

  it("escapes backslashes before quotes so the result stays balanced", () => {
    // A backslash followed by a quote must not collapse into an escaped quote
    // that swallows the closing delimiter of the filter expression.
    expect(escapeFilterString('a\\"b')).toBe('a\\\\\\"b');
  });

  it("escapes a lone backslash", () => {
    expect(escapeFilterString("a\\b")).toBe("a\\\\b");
  });

  it("produces a filter expression with balanced quotes", () => {
    // The escaped value is wrapped in `text ~ "<value>"`. Stripping the
    // escapes back out should recover the original input exactly.
    const malicious = '"; drop \\ everything "';
    const filter = `text ~ "${escapeFilterString(malicious)}"`;
    const inner = filter.slice('text ~ "'.length, -1);
    const unescaped = inner.replace(/\\(.)/g, "$1");
    expect(unescaped).toBe(malicious);
  });
});
