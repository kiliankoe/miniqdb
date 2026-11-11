import { createFileRoute } from "@tanstack/react-router";
import { Box, Button, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { orange } from "@mui/material/colors";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loading } from "@/components/Loading";
import { QuoteView } from "@/components/QuoteView";
import {
  type GuessCandidate,
  groupBySpeaker,
  parseAliases,
  pickRound,
} from "@/lib/guess";
import { useGuessQuotes, useQuote, useSpeakerAliases } from "@/lib/queries";
import type { QuoteRecord } from "@/lib/types";

const BEST_STREAK_KEY = "guessBestStreak";

type GuessQuote = Pick<QuoteRecord, "id" | "shortId" | "text">;

export const Route = createFileRoute("/_authenticated/guess")({
  component: GuessPage,
});

function GuessPage() {
  const quotes = useGuessQuotes();
  const aliases = useSpeakerAliases();
  const groups = useMemo(
    () => groupBySpeaker(quotes.data ?? [], parseAliases(aliases.data ?? "")),
    [quotes.data, aliases.data],
  );
  const error = quotes.error ?? aliases.error;

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (quotes.isLoading || aliases.isLoading) {
    return <Loading />;
  }

  return <Game groups={groups} />;
}

function Game({
  groups,
}: {
  groups: Map<string, GuessCandidate<GuessQuote>[]>;
}) {
  // Quotes shown so far, so a page visit never repeats one.
  const [{ round, seen }, setRoundState] = useState(() => {
    const first = pickRound(groups);
    return { round: first, seen: new Set(first ? [first.quote.id] : []) };
  });
  const [guess, setGuess] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, played: 0, streak: 0 });
  const [best, setBest] = useState(
    () => Number(localStorage.getItem(BEST_STREAK_KEY)) || 0,
  );

  const nextRound = useCallback(
    (fresh = false) => {
      const exclude = fresh ? new Set<string>() : seen;
      // Emptied speakers drop out entirely: one left among the options could
      // be ruled out as never the answer.
      const unseen = new Map(
        [...groups].map(([name, candidates]) => [
          name,
          candidates.filter((c) => !exclude.has(c.quote.id)),
        ]),
      );
      const next = pickRound(unseen);
      setRoundState({
        round: next,
        seen: next ? new Set([...exclude, next.quote.id]) : exclude,
      });
      setGuess(null);
    },
    [groups, seen],
  );

  const answer = useCallback(
    (name: string) => {
      if (!round || guess !== null) return;
      setGuess(name);
      const correct = name === round.answer;
      const streak = correct ? score.streak + 1 : 0;
      setScore({
        correct: score.correct + (correct ? 1 : 0),
        played: score.played + 1,
        streak,
      });
      if (streak > best) {
        setBest(streak);
        localStorage.setItem(BEST_STREAK_KEY, String(streak));
      }
    },
    [round, guess, score, best],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || !round) return;
      if (guess === null) {
        const option = round.options[Number(e.key) - 1];
        if (option) answer(option);
      } else if (e.key === "Enter") {
        // Keep the focused option button from also receiving the Enter.
        e.preventDefault();
        nextRound();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [round, guess, answer, nextRound]);

  if (!round && seen.size > 0) {
    return (
      <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
        <div>You've seen every quote.</div>
        <Button
          variant="contained"
          onClick={() => nextRound(true)}
          sx={{
            backgroundColor: orange[700],
            color: "white",
            "&:hover": { backgroundColor: orange[800] },
          }}
        >
          Play again
        </Button>
      </Stack>
    );
  }

  if (!round) {
    return <div>Not enough quotes with a recognizable speaker to play.</div>;
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: { xs: "100%", sm: "90%", md: "80%" } }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontFamily: "monospace" }}
      >
        {score.correct}/{score.played} correct · streak {score.streak} · best{" "}
        {best}
      </Typography>

      <RoundQuote
        key={round.quote.id}
        quote={round.quote}
        masked={round.masked}
        revealed={guess !== null}
      />

      <Stack spacing={1} sx={{ maxWidth: 400 }}>
        {round.options.map((name, i) => {
          const result =
            guess === null
              ? null
              : name === round.answer
                ? "success"
                : name === guess
                  ? "error"
                  : null;
          return (
            <Button
              key={name}
              variant="outlined"
              color="inherit"
              onClick={() => answer(name)}
              // Not `disabled`: that would grey out the colored result.
              sx={{
                justifyContent: "flex-start",
                textTransform: "none",
                pointerEvents: guess === null ? "auto" : "none",
                // A tint rather than a fill, to sit quietly next to the
                // orange accent.
                ...(result && {
                  borderColor: `${result}.main`,
                  backgroundColor: (theme) =>
                    alpha(theme.palette[result].main, 0.08),
                }),
                ...(guess === null && {
                  "&:hover, &.Mui-focusVisible": {
                    borderColor: orange[700],
                    backgroundColor: "rgba(251, 140, 0, 0.04)",
                  },
                }),
              }}
            >
              <Box
                component="span"
                sx={{ fontFamily: "monospace", mr: 1, opacity: 0.6 }}
              >
                {i + 1}
              </Box>
              {name}
            </Button>
          );
        })}
      </Stack>

      {guess !== null && (
        <Box>
          <Button
            variant="contained"
            onClick={() => nextRound()}
            sx={{
              backgroundColor: orange[700],
              color: "white",
              "&:hover": { backgroundColor: orange[800] },
            }}
          >
            Next
          </Button>
        </Box>
      )}
    </Stack>
  );
}

// Renders the full QuoteView from the start, with its date and vote row
// hidden and the text masked, so the reveal doesn't shift the layout. The
// full quote loads while the player is still guessing.
function RoundQuote({
  quote,
  masked,
  revealed,
}: {
  quote: GuessQuote;
  masked: string;
  revealed: boolean;
}) {
  const { data: full, isLoading } = useQuote(String(quote.shortId));
  // The game's quote list isn't refreshed on deletes, so this can happen.
  if (revealed && !full && !isLoading) {
    return <div>This quote has been deleted.</div>;
  }
  const shown = revealed && full;
  return (
    <QuoteView
      quote={
        shown
          ? full
          : {
              ...quote,
              text: masked,
              author: "",
              score: 0,
              vote: 0,
              created: full?.created ?? "",
              updated: "",
            }
      }
      metaHidden={!shown}
    />
  );
}
