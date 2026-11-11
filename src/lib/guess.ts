// "Guess who said it": the speaker only exists inside the free-text quote, as
// an attribution after the closing quote mark, e.g. `"…" - Name, context`.

export interface ParsedQuote {
  speaker: string;
  masked: string;
}

export interface GuessCandidate<T> {
  quote: T;
  masked: string;
}

export interface Round<T> {
  quote: T;
  masked: string;
  answer: string;
  options: string[];
}

const MASK = "???";
const OPTION_COUNT = 4;

// A dash-separated attribution may be any name; without a dash, require a
// capitalized name so trailing prose isn't mistaken for a speaker. Sentence
// punctuation sometimes ends up after the closing quote mark.
const ATTRIBUTION = /^([.!?]?(?:\s*(?:--|[-–—])\s*|\s+(?=\p{Lu})))(\S.*)$/u;
// The name ends where context starts: `, …`, `(…)`, `zu X`, `to X`.
const CONTEXT_START = /,|\(| zu | to /;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Also masks the genitive (`Vincents` → `???s`).
function maskWords(text: string, words: string[]): string {
  return words.reduce(
    (acc, word) =>
      acc.replace(
        new RegExp(
          `(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?=s?(?![\\p{L}\\p{N}]))`,
          "gu",
        ),
        MASK,
      ),
    text,
  );
}

export function parseSpeaker(text: string): ParsedQuote | null {
  const trimmed = text.trimEnd();
  const close = Math.max(...[...`"“”„«»`].map((m) => trimmed.lastIndexOf(m)));
  if (close < 0) return null;

  const match = trimmed.slice(close + 1).match(ATTRIBUTION);
  if (!match) return null;
  const [, separator, attribution] = match;

  const contextIndex = attribution.search(CONTEXT_START);
  const speaker = attribution
    .slice(0, contextIndex < 0 ? undefined : contextIndex)
    .trimEnd();
  if (!speaker) return null;

  // Mentions of the speaker elsewhere would give the answer away. Initials
  // like `B.` are too short to mask safely.
  const names = [
    speaker,
    ...speaker.split(" ").filter((w) => w.length > 1 && !w.endsWith(".")),
  ];
  const head = maskWords(trimmed.slice(0, close + 1), names);
  const context = maskWords(attribution.slice(speaker.length), names);
  return { speaker, masked: `${head}${separator}${MASK}${context}` };
}

// Spellings of one person can't be matched by rule (`Vincent Lindner` is a
// joke name for `Vincent`; a bare `Peter` means `Peter B.`, not `Peter D.`),
// so the deployment lists them: `Vincent Lindner=Vincent, Peter=Peter B.`.
export function parseAliases(spec: string): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const entry of spec.split(",")) {
    const separator = entry.indexOf("=");
    const name = entry.slice(0, separator).trim();
    const canonical = entry.slice(separator + 1).trim();
    if (separator >= 0 && name && canonical) aliases.set(name, canonical);
  }
  return aliases;
}

export function groupBySpeaker<T extends { text: string }>(
  quotes: T[],
  aliases: Map<string, string> = new Map(),
): Map<string, GuessCandidate<T>[]> {
  const groups = new Map<string, GuessCandidate<T>[]>();
  for (const quote of quotes) {
    const parsed = parseSpeaker(quote.text);
    if (!parsed) continue;
    const key = aliases.get(parsed.speaker) ?? parsed.speaker;
    const group = groups.get(key) ?? [];
    group.push({ quote, masked: parsed.masked });
    groups.set(key, group);
  }
  return groups;
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function pickRound<T>(
  groups: Map<string, GuessCandidate<T>[]>,
  random: () => number = Math.random,
): Round<T> | null {
  const speakers = [...groups].filter(([, candidates]) => candidates.length);
  if (speakers.length < 2) return null;

  // Speaker first, then quote: otherwise the most quoted person is always the
  // safe guess.
  const [answer, candidates] = pick(speakers, random);
  const { quote, masked } = pick(candidates, random);

  // Uniform distractors keep every shown name equally likely to be the
  // answer; weighting by quote count would mark outliers as the answer.
  const distractors = shuffle(
    speakers.filter(([name]) => name !== answer),
    random,
  )
    .slice(0, OPTION_COUNT - 1)
    .map(([name]) => name);

  return {
    quote,
    masked,
    answer,
    options: shuffle([answer, ...distractors], random),
  };
}
