import type { Quote } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import React from "react";

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
    <div className="flex flex-col gap-1">
      <div className="flex flex-row gap-4 items-center">
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
      </div>
      <div>
        {quote.text?.split("\\n").map((line, i) => (
          <React.Fragment key={i}>
            {parseMarkdownLinks(line)}
            <br />
          </React.Fragment>
        ))}
      </div>
    </div>
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
  const sharedClasses =
    "px-1 py-0 active:translate-y-0.5 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-700";
  return (
    <div className="flex items-center gap-2 flex-row">
      <button
        disabled={isDownvoted}
        className={`${sharedClasses} bg-orange-400 dark:bg-orange-800 hover:bg-orange-500 dark:hover:bg-orange-700`}
      >
        <Image src="/chevron-up.svg" alt="upvote" width={18} height={18} />
      </button>
      <span className="font-mono">{score}</span>
      <button
        disabled={isUpvoted}
        className={`${sharedClasses} bg-purple-400 dark:bg-purple-800 hover:bg-purple-500 dark:hover:bg-purple-700`}
      >
        <Image src="/chevron-down.svg" alt="downvote" width={18} height={18} />
      </button>
    </div>
  );
}
