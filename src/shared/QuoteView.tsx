import type { QuoteResponse } from "@/app/api/quotes/QuoteResponse";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { IconButton, Stack, Typography } from "@mui/material";
import { blue, orange } from "@mui/material/colors";
import Link from "next/link";
import React from "react";

function parseMarkdownLinks(text: string) {
  return text.split(/(\[.*?\]\(.*?\))/).map((segment, j) => {
    const linkMatch = segment.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      const [, text, url] = linkMatch;
      return (
        <a key={j} href={url} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      );
    }
    return segment;
  });
}

export function QuoteView({ quote }: { quote: QuoteResponse }) {
  const createdAt = new Date(quote.createdAt);

  return (
    <Stack direction="column" spacing={0}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Link href={`/${quote.id}`}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontFamily: "monospace",
              textDecoration: "none",
              textUnderlineOffset: 1,
              textDecorationColor: "white",
            }}
          >
            {createdAt.toLocaleString("de-DE", {
              year: "2-digit",
              month: "2-digit",
              day: "2-digit",
            })}
          </Typography>
        </Link>
        <VoteView score={quote.score} vote={quote.vote} />
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

function VoteView({ score, vote }: { score: number; vote?: number }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
      <IconButton
        size="small"
        sx={{
          "& .MuiSvgIcon-root": {
            color: vote === 1 ? orange[400] : "text.secondary",
          },
        }}
      >
        <ExpandLessIcon />
      </IconButton>
      <Typography variant="body1" sx={{ fontFamily: "monospace", width: "25px", textAlign: "center" }}>
        {score}
      </Typography>
      <IconButton
        size="small"
        sx={{
          "& .MuiSvgIcon-root": {
            color: vote === -1 ? blue[400] : "text.secondary",
          },
        }}
      >
        <ExpandMoreIcon />
      </IconButton>
    </Stack>
  );
}
