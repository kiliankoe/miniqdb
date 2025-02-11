import { Button, Stack } from "@mui/material";
import type { Quote } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
// This feels like a hack lol
type ClientQuote = Pick<Quote, "id" | "text" | "createdAt"> & { score: number };

function parseMarkdownLinks(text: string) {
  return text.split(/(\[.*?\]\(.*?\))/).map((segment, j) => {
    const linkMatch = segment.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      const [_, text, url] = linkMatch;
      return (
        <a key={j} href={url} className="underline hover:text-blue-400" target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      );
    }
    return segment;
  });
}

export function QuoteView({ quote }: { quote: ClientQuote }) {
  return (
    <Stack direction="column" spacing={1}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Link href={`/${quote.id}`}>
          <div className="text-sm font-mono text-gray-500 underline-offset-2 underline">
            {quote.createdAt.toLocaleString("de-DE", {
              year: "2-digit",
              month: "2-digit",
              day: "2-digit",
            })}
          </div>
        </Link>
        <VoteView score={quote.score} />
      </Stack>
      <div>
        {quote.text?.split("\\n").map((line, i) => (
          <React.Fragment key={i}>
            {parseMarkdownLinks(line)}
            <br />
          </React.Fragment>
        ))}
      </div>
    </Stack>
  );
}

function VoteView({
  score,
  isUpvoted = false,
  isDownvoted = false,
}: {
  score: number;
  isUpvoted?: boolean;
  isDownvoted?: boolean;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" color="secondary" size="small" sx={{ borderRadius: 0 }}>
        <ExpandLessIcon fontSize="small" />
      </Button>
      <span className="font-mono">{score}</span>
      <Button variant="contained" color="secondary" size="small" sx={{ borderRadius: 0 }}>
        <ExpandMoreIcon fontSize="small" />
      </Button>
    </Stack>
  );
}
