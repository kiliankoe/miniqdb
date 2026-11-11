import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type GuessCandidate,
  groupBySpeaker,
  parseAliases,
  parseSpeaker,
  pickRound,
} from "@/lib/guess";

// Small deterministic PRNG so rounds are reproducible from a seed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole word in the sense of "not adjacent to another letter or digit", so
// `Max` inside `Maximum` does not count.
function containsWord(haystack: string, word: string): boolean {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`,
    "u",
  ).test(haystack);
}

type Q = { id: string; text: string };

function candidates(n: number, prefix: string): GuessCandidate<Q>[] {
  return Array.from({ length: n }, (_, i) => ({
    quote: { id: `${prefix}-${i}`, text: `"q${i}" - ${prefix}` },
    masked: `"q${i}" - ???`,
  }));
}

function groupsOf(counts: Record<string, number>) {
  return new Map(
    Object.entries(counts).map(([name, n]) => [name, candidates(n, name)]),
  );
}

describe("parseSpeaker", () => {
  it.each([
    {
      text: '"Bücher sind das alte TikTok." - Vincent',
      speaker: "Vincent",
      masked: '"Bücher sind das alte TikTok." - ???',
    },
    {
      text: '"Das kann man so nicht sagen." - Christian G.',
      speaker: "Christian G.",
      masked: '"Das kann man so nicht sagen." - ???',
    },
    {
      text: '"Das ist halt so." – Peter B. zu Vincent',
      speaker: "Peter B.",
      masked: '"Das ist halt so." – ??? zu Vincent',
    },
    {
      text: '"That is fine." - Peter B. to Vincent',
      speaker: "Peter B.",
      masked: '"That is fine." - ??? to Vincent',
    },
    {
      text: '"I will do it." - Marielle, responsible for writing the documentation',
      speaker: "Marielle",
      masked:
        '"I will do it." - ???, responsible for writing the documentation',
    },
    {
      text: '"Ja, genau." - Marielle (nur mit [Kontext](https://www.youtube.com/watch?v=jPCJIB1f7jk))',
      speaker: "Marielle",
      masked:
        '"Ja, genau." - ??? (nur mit [Kontext](https://www.youtube.com/watch?v=jPCJIB1f7jk))',
    },
    {
      text: '"Das geht schon." - JoZi (beim Pushen auf main)',
      speaker: "JoZi",
      masked: '"Das geht schon." - ??? (beim Pushen auf main)',
    },
    {
      text: '"Dein Kürzel ist einfach kurz für Motherfucker!" Marielle zu Max',
      speaker: "Marielle",
      masked: '"Dein Kürzel ist einfach kurz für Motherfucker!" ??? zu Max',
    },
    {
      text: '"Erste Zeile,\nzweite Zeile.\ndritte Zeile." - Vincent',
      speaker: "Vincent",
      masked: '"Erste Zeile,\nzweite Zeile.\ndritte Zeile." - ???',
    },
    {
      text: '"Vincent, hör auf." - Vincent Lindner',
      speaker: "Vincent Lindner",
      masked: '"???, hör auf." - ???',
    },
    {
      text: '"Frag Vincent Lindner." - Vincent Lindner',
      speaker: "Vincent Lindner",
      masked: '"Frag ???." - ???',
    },
    {
      text: '"Ich kenne nur große Dübel". - Vincent',
      speaker: "Vincent",
      masked: '"Ich kenne nur große Dübel". - ???',
    },
    {
      text: '"Passt schon." — Vincent',
      speaker: "Vincent",
      masked: '"Passt schon." — ???',
    },
    {
      text: '"Passt schon." -- Vincent',
      speaker: "Vincent",
      masked: '"Passt schon." -- ???',
    },
    {
      text: '"Das war Vincents Idee." - Vincent',
      speaker: "Vincent",
      masked: '"Das war ???s Idee." - ???',
    },
    {
      text: '"Herr Lindner, bitte." - Vincent Lindner',
      speaker: "Vincent Lindner",
      masked: '"Herr ???, bitte." - ???',
    },
    {
      text: '"Maximum effort." - Max',
      speaker: "Max",
      masked: '"Maximum effort." - ???',
    },
  ])("parses $speaker from $text", ({ text, speaker, masked }) => {
    expect(parseSpeaker(text)).toEqual({ speaker, masked });
  });

  it.each([
    ["„Hallo.“", "German quotes"],
    ["“Hello.”", "curly quotes"],
    ["«Salut.»", "guillemets"],
    ["»Hallo.«", "reversed guillemets"],
    ['"Hallo."', "straight quotes"],
    ["“Hallo.„", "low double quote as closer"],
  ])("accepts %s (%s) as the quoted part", (quoted) => {
    expect(parseSpeaker(`${quoted} - Vincent`)).toEqual({
      speaker: "Vincent",
      masked: `${quoted} - ???`,
    });
  });

  it.each([
    ["a multi-line dialogue", 'Stephan H.: "Na, gut erholt?"\nPeter B.: "Ne…"'],
    [
      "a narrative without attribution",
      "9:24 Uhr, Peter B. kommt rein, geht zu seinem Schreibtisch. “Oah, ich hab noch Bier!”",
    ],
    ["plain text", "Heute gibt es Pizza."],
    ["a quote without attribution", '"Heute gibt es Pizza."'],
    ["empty text", ""],
  ])("returns null for %s", (_label, text) => {
    expect(parseSpeaker(text)).toBeNull();
  });

  const lowerWord = fc.stringMatching(/^[a-zäöü]{1,8}$/);
  const capWord = fc.stringMatching(/^[A-Z][a-z]{2,8}$/);
  const name = fc.oneof(
    capWord,
    fc
      .tuple(capWord, fc.stringMatching(/^[A-Z]\.$/))
      .map(([a, b]) => `${a} ${b}`),
    fc.tuple(capWord, capWord).map(([a, b]) => `${a} ${b}`),
  );

  it("extracts the name and masks every whole-word mention of it", () => {
    fc.assert(
      fc.property(
        name,
        capWord,
        fc.array(lowerWord, { minLength: 1, maxLength: 8 }),
        fc.array(fc.constantFrom("full", "first", "none"), {
          minLength: 1,
          maxLength: 8,
        }),
        fc.constantFrom("-", "–", ""),
        fc.constantFrom("none", "comma", "paren", "zu", "to"),
        lowerWord,
        (speaker, other, words, inserts, dash, contextKind, ctxWord) => {
          const first = speaker.split(" ")[0];
          fc.pre(other !== first && !speaker.split(" ").includes(other));
          // Interleave body words with optional mentions of the speaker.
          const body = words
            .flatMap((w, i) => {
              const ins = inserts[i % inserts.length];
              if (ins === "full") return [speaker, w];
              if (ins === "first") return [first, w];
              return [w];
            })
            .join(" ");
          const context = {
            none: "",
            comma: `, ${ctxWord}`,
            paren: ` (${ctxWord})`,
            zu: ` zu ${other}`,
            to: ` to ${other}`,
          }[contextKind];
          const sep = dash ? ` ${dash} ` : " ";
          const text = `"${body}"${sep}${speaker}${context}`;

          const parsed = parseSpeaker(text);
          expect(parsed).not.toBeNull();
          if (!parsed) return;
          expect(parsed.speaker).toBe(speaker);
          expect(parsed.masked.endsWith(`${sep}???${context}`)).toBe(true);
          expect(containsWord(parsed.masked, speaker)).toBe(false);
          expect(containsWord(parsed.masked, first)).toBe(false);
        },
      ),
    );
  });
});

describe("parseAliases", () => {
  it("parses comma-separated name=canonical entries", () => {
    expect(parseAliases("Vincent Lindner=Vincent, Peter=Peter B.")).toEqual(
      new Map([
        ["Vincent Lindner", "Vincent"],
        ["Peter", "Peter B."],
      ]),
    );
  });

  it("trims whitespace around names and entries", () => {
    expect(
      parseAliases("  Vincent Lindner  =  Vincent ,\tPeter= Peter B.  "),
    ).toEqual(
      new Map([
        ["Vincent Lindner", "Vincent"],
        ["Peter", "Peter B."],
      ]),
    );
  });

  it.each([
    ["empty input", ""],
    ["only whitespace", "   "],
    ["only commas", " , ,, "],
  ])("returns no entries for %s", (_label, spec) => {
    expect(parseAliases(spec).size).toBe(0);
  });

  it("skips empty entries such as a trailing comma", () => {
    expect(parseAliases("Peter=Peter B.,, ,")).toEqual(
      new Map([["Peter", "Peter B."]]),
    );
    expect(parseAliases(",Peter=Peter B.")).toEqual(
      new Map([["Peter", "Peter B."]]),
    );
  });

  it.each([
    ["an entry without =", "Peter"],
    ["an empty name", "=Peter B."],
    ["an empty canonical name", "Peter="],
    ["blank sides", "  =  "],
  ])("ignores %s and keeps the valid entries", (_label, bad) => {
    expect(
      parseAliases(`Vincent Lindner=Vincent, ${bad}, Max=Maximilian K.`),
    ).toEqual(
      new Map([
        ["Vincent Lindner", "Vincent"],
        ["Max", "Maximilian K."],
      ]),
    );
  });

  it("round-trips generated pairs", () => {
    const word = fc.stringMatching(/^[A-Za-zÄÖÜäöü][A-Za-zÄÖÜäöü.]{0,7}$/);
    const nameArb = fc
      .array(word, { minLength: 1, maxLength: 3 })
      .map((ws) => ws.join(" "));
    const ws = fc.constantFrom("", " ", "  ", "\t");
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.tuple(nameArb, nameArb), {
          selector: ([name]) => name,
          maxLength: 8,
        }),
        fc.array(fc.tuple(ws, ws, ws, ws), { minLength: 8, maxLength: 8 }),
        fc.boolean(),
        (pairs, pads, trailingComma) => {
          const spec =
            pairs
              .map(
                ([name, canonical], i) =>
                  `${pads[i][0]}${name}${pads[i][1]}=${pads[i][2]}${canonical}${pads[i][3]}`,
              )
              .join(",") + (trailingComma ? "," : "");
          expect(parseAliases(spec)).toEqual(new Map(pairs));
        },
      ),
    );
  });
});

describe("groupBySpeaker", () => {
  it("groups by speaker, drops unparseable quotes and keeps the original objects", () => {
    const quotes: Q[] = [
      { id: "1", text: '"Eins." - Vincent' },
      { id: "2", text: '"Zwei." - Marielle' },
      { id: "3", text: "Kein Zitat." },
      { id: "4", text: '"Drei." - Vincent' },
    ];
    const groups = groupBySpeaker(quotes);
    expect([...groups.keys()].sort()).toEqual(["Marielle", "Vincent"]);
    const vincent = groups.get("Vincent") ?? [];
    expect(vincent.map((c) => c.quote)).toEqual([quotes[0], quotes[3]]);
    expect(vincent[0].quote).toBe(quotes[0]);
    expect(vincent.map((c) => c.masked)).toEqual([
      '"Eins." - ???',
      '"Drei." - ???',
    ]);
  });

  it("returns an empty map when nothing is parseable", () => {
    expect(groupBySpeaker([{ text: "nichts" }, { text: "" }]).size).toBe(0);
    expect(
      groupBySpeaker(
        [{ text: "nichts" }],
        new Map([["Vincent Lindner", "Vincent"]]),
      ).size,
    ).toBe(0);
  });

  it("merges no names without aliases", () => {
    const groups = groupBySpeaker([
      { text: '"A." - Vincent' },
      { text: '"B." - Vincent Lindner' },
      { text: '"C." - Peter' },
      { text: '"D." - Peter B.' },
      { text: '"E." - Peter D.' },
    ]);
    expect([...groups.keys()].sort()).toEqual([
      "Peter",
      "Peter B.",
      "Peter D.",
      "Vincent",
      "Vincent Lindner",
    ]);
    for (const list of groups.values()) expect(list).toHaveLength(1);
  });

  it("files a joke name under the real name", () => {
    const quotes = [
      { text: '"A." - Vincent' },
      { text: '"B." - Vincent Lindner' },
      { text: '"C." - Vincent' },
    ];
    const groups = groupBySpeaker(
      quotes,
      new Map([["Vincent Lindner", "Vincent"]]),
    );
    expect([...groups.keys()]).toEqual(["Vincent"]);
    const merged = groups.get("Vincent") ?? [];
    expect(merged).toHaveLength(3);
    expect(new Set(merged.map((c) => c.quote))).toEqual(new Set(quotes));
    const lindner = merged.find((c) => c.quote === quotes[1]);
    expect(lindner?.masked).toBe('"B." - ???');
  });

  it("files a bare first name under the aliased person even when others share it", () => {
    const quotes = [
      { text: '"A." - Peter' },
      { text: '"B." - Peter B.' },
      { text: '"C." - Peter D.' },
    ];
    const groups = groupBySpeaker(quotes, parseAliases("Peter=Peter B."));
    expect([...groups.keys()].sort()).toEqual(["Peter B.", "Peter D."]);
    expect(new Set((groups.get("Peter B.") ?? []).map((c) => c.quote))).toEqual(
      new Set([quotes[0], quotes[1]]),
    );
    expect((groups.get("Peter D.") ?? []).map((c) => c.quote)).toEqual([
      quotes[2],
    ]);
  });

  it("handles both real cases from one alias spec", () => {
    const groups = groupBySpeaker(
      [
        { text: '"A." - Vincent Lindner' },
        { text: '"B." - Vincent' },
        { text: '"C." - Peter' },
        { text: '"D." - Peter B.' },
        { text: '"E." - Peter D.' },
      ],
      parseAliases("Vincent Lindner=Vincent, Peter=Peter B."),
    );
    expect(
      Object.fromEntries([...groups].map(([k, l]) => [k, l.length])),
    ).toEqual({ Vincent: 2, "Peter B.": 2, "Peter D.": 1 });
  });

  it("does not chain aliases", () => {
    const groups = groupBySpeaker(
      [{ text: '"A." - Alpha' }, { text: '"B." - Beta' }],
      new Map([
        ["Alpha", "Beta"],
        ["Beta", "Gamma"],
      ]),
    );
    expect([...groups.keys()].sort()).toEqual(["Beta", "Gamma"]);
    expect(groups.get("Beta")?.[0].quote.text).toBe('"A." - Alpha');
    expect(groups.get("Gamma")?.[0].quote.text).toBe('"B." - Beta');
  });

  it("ignores aliases for names that never occur", () => {
    const quotes = [{ text: '"A." - Vincent' }, { text: '"B." - Marielle' }];
    const groups = groupBySpeaker(
      quotes,
      new Map([
        ["Nobody", "Vincent"],
        ["Ghost", "Phantom"],
      ]),
    );
    expect([...groups.keys()].sort()).toEqual(["Marielle", "Vincent"]);
    expect(groups.has("Phantom")).toBe(false);
    for (const list of groups.values()) expect(list).toHaveLength(1);
  });

  it("keeps every parseable quote exactly once under its aliased key", () => {
    const names = [
      "Vincent",
      "Vincent Lindner",
      "Peter",
      "Peter B.",
      "Peter D.",
      "Marielle",
      "JoZi",
    ];
    const speakerName = fc.constantFrom(...names);
    const quote = fc.oneof(
      fc
        .tuple(fc.stringMatching(/^[a-z ]{1,20}$/), speakerName)
        .map(([body, who]) => ({ text: `"${body}." - ${who}` })),
      fc.constant({ text: "Kein Zitat hier." }),
    );
    const aliasesArb = fc
      .uniqueArray(
        fc.tuple(
          fc.constantFrom(...names, "Nobody"),
          fc.constantFrom(...names, "Someone Else"),
        ),
        { selector: ([name]) => name, maxLength: 5 },
      )
      .map((pairs) => new Map(pairs));
    fc.assert(
      fc.property(
        fc.array(quote, { maxLength: 30 }),
        aliasesArb,
        (quotes, aliases) => {
          const groups = groupBySpeaker(quotes, aliases);
          const seen = [...groups.values()].flat();
          const parseable = quotes.filter((q) => parseSpeaker(q.text) !== null);
          expect(seen).toHaveLength(parseable.length);
          expect(new Set(seen.map((c) => c.quote)).size).toBe(
            new Set(parseable).size,
          );
          for (const [key, list] of groups) {
            expect(list.length).toBeGreaterThan(0);
            for (const c of list) {
              const parsed = parseSpeaker(c.quote.text);
              expect(parsed).not.toBeNull();
              if (!parsed) continue;
              expect(c.masked).toBe(parsed.masked);
              expect(key).toBe(aliases.get(parsed.speaker) ?? parsed.speaker);
            }
          }
        },
      ),
    );
  });
});

describe("pickRound", () => {
  it("returns null with fewer than two speakers", () => {
    expect(pickRound(new Map())).toBeNull();
    expect(pickRound(groupsOf({ Vincent: 3 }))).toBeNull();
    expect(pickRound(groupsOf({ Vincent: 3, Marielle: 0 }))).toBeNull();
  });

  const groupsArb = fc
    .uniqueArray(fc.stringMatching(/^[A-Z][a-z]{1,6}$/), {
      minLength: 0,
      maxLength: 10,
    })
    .chain((names) =>
      fc
        .array(fc.integer({ min: 0, max: 6 }), {
          minLength: names.length,
          maxLength: names.length,
        })
        .map((counts) =>
          groupsOf(Object.fromEntries(names.map((n, i) => [n, counts[i]]))),
        ),
    );

  it("produces well-formed rounds for arbitrary groups and seeds", () => {
    fc.assert(
      fc.property(groupsArb, fc.integer(), (groups, seed) => {
        const speakers = [...groups].filter(([, l]) => l.length > 0);
        const round = pickRound(groups, mulberry32(seed));
        if (speakers.length < 2) {
          expect(round).toBeNull();
          return;
        }
        expect(round).not.toBeNull();
        if (!round) return;
        const answerCandidates = groups.get(round.answer) ?? [];
        expect(answerCandidates).toContainEqual({
          quote: round.quote,
          masked: round.masked,
        });
        expect(round.options).toHaveLength(Math.min(4, speakers.length));
        expect(new Set(round.options).size).toBe(round.options.length);
        expect(round.options).toContain(round.answer);
        for (const o of round.options) {
          expect((groups.get(o) ?? []).length).toBeGreaterThan(0);
        }
      }),
    );
  });

  it("is deterministic for a deterministic random source", () => {
    fc.assert(
      fc.property(groupsArb, fc.integer(), (groups, seed) => {
        expect(pickRound(groups, mulberry32(seed))).toEqual(
          pickRound(groups, mulberry32(seed)),
        );
      }),
    );
  });

  it.each([0, 0.5, 0.9999999999])(
    "copes with a constant random source of %d",
    (value) => {
      const round = pickRound(
        groupsOf({ A: 1, B: 2, C: 3, D: 4, E: 5 }),
        () => value,
      );
      expect(round).not.toBeNull();
      expect(new Set(round?.options).size).toBe(4);
      expect(round?.options).toContain(round?.answer);
    },
  );

  it("picks speakers uniformly, not weighted by quote count", () => {
    const groups = groupsOf({ Prolific: 100, A: 1, B: 1, C: 1 });
    const rng = mulberry32(42);
    const counts = new Map<string, number>();
    const rounds = 4000;
    for (let i = 0; i < rounds; i++) {
      const r = pickRound(groups, rng);
      if (!r) throw new Error("expected a round");
      counts.set(r.answer, (counts.get(r.answer) ?? 0) + 1);
    }
    for (const name of groups.keys()) {
      const share = (counts.get(name) ?? 0) / rounds;
      expect(share).toBeGreaterThan(0.18);
      expect(share).toBeLessThan(0.32);
    }
  });

  it("eventually picks every quote of a speaker", () => {
    const groups = groupsOf({ A: 3, B: 1 });
    const rng = mulberry32(7);
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const r = pickRound(groups, rng);
      if (r?.answer === "A") seen.add(r.quote.id);
    }
    expect(seen).toEqual(new Set(["A-0", "A-1", "A-2"]));
  });

  it("varies the position of the answer among the options", () => {
    const groups = groupsOf({ A: 1, B: 1, C: 1, D: 1, E: 1, F: 1 });
    const rng = mulberry32(1234);
    const positions = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const r = pickRound(groups, rng);
      if (r) positions.add(r.options.indexOf(r.answer));
    }
    expect(positions).toEqual(new Set([0, 1, 2, 3]));
  });

  it("never gives the answer away by who is shown", () => {
    // A lopsided pool: whoever appears among the options must be the answer
    // about a quarter of the time, however often they are quoted.
    const counts: Record<string, number> = { Prolific: 60, Mid: 25 };
    for (let i = 0; i < 8; i++) counts[`R${i}`] = 1 + i;
    const groups = groupsOf(counts);
    const rng = mulberry32(5);
    const shown = new Map<string, number>();
    const won = new Map<string, number>();
    for (let i = 0; i < 20000; i++) {
      const r = pickRound(groups, rng);
      if (!r) throw new Error("expected a round");
      for (const o of r.options) shown.set(o, (shown.get(o) ?? 0) + 1);
      won.set(r.answer, (won.get(r.answer) ?? 0) + 1);
    }
    for (const name of groups.keys()) {
      const share = (won.get(name) ?? 0) / (shown.get(name) ?? 1);
      expect(share).toBeGreaterThan(0.2);
      expect(share).toBeLessThan(0.3);
    }
  });
});
