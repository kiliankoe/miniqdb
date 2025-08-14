import { PrismaClient } from "@prisma/client";
import type { QuotesResponse } from "./QuoteResponse";
import type { Sort } from "./Sort";

export async function getQuote(quoteId: string, author?: string) {
  const db = new PrismaClient();
  const id = parseInt(quoteId);
  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      votes: true,
    },
  });
  if (!quote) {
    return null;
  }

  const userVote = author
    ? (quote.votes.find((vote) => vote.author === author)?.value ?? 0)
    : 0;

  return {
    id: quote.id,
    createdAt: quote.createdAt,
    score: quote.votes.reduce((acc, vote) => acc + vote.value, 0),
    vote: userVote,
    text: quote.text,
  };
}

export async function getQuotes(
  sort: Sort,
  page: number,
  limit: number,
  author?: string,
) {
  const db = new PrismaClient();
  const totalCount = await db.quote.count();

  if (sort === "random") {
    if (totalCount <= limit) {
      const quotes = await db.quote.findMany({
        take: totalCount,
        orderBy: {
          id: "asc",
        },
        include: {
          votes: true,
        },
      });

      const shuffledQuotes = quotes.sort(() => Math.random() - 0.5);

      return {
        quotes: shuffledQuotes.map((quote) => ({
          id: quote.id,
          createdAt: quote.createdAt,
          score: quote.votes.reduce((acc, vote) => acc + vote.value, 0),
          vote: author
            ? (quote.votes.find((vote) => vote.author === author)?.value ?? 0)
            : 0,
          text: quote.text,
        })),
        totalCount,
        pageCount: Math.ceil(totalCount / limit),
      } satisfies QuotesResponse;
    }

    const skip = Math.floor(Math.random() * (totalCount - limit + 1));
    const quotes = await db.quote.findMany({
      skip,
      take: limit,
      include: {
        votes: true,
      },
    });
    return {
      quotes: quotes.map((quote) => ({
        id: quote.id,
        createdAt: quote.createdAt,
        score: quote.votes.reduce((acc, vote) => acc + vote.value, 0),
        vote: author
          ? (quote.votes.find((vote) => vote.author === author)?.value ?? 0)
          : 0,
        text: quote.text,
      })),
      totalCount,
      pageCount: Math.ceil(totalCount / limit),
    } satisfies QuotesResponse;
  }

  let quotes;
  if (sort === "top") {
    // FIXME: This fetches all quotes and sorts them. Instead of this, the Quote table should have a score column that
    // is updated when a vote is cast. Or maybe have a db view that aggregates this?
    const allQuotes = await db.quote.findMany({
      include: {
        votes: true,
      },
    });

    allQuotes.sort((a, b) => {
      const scoreA = a.votes.reduce((acc, vote) => acc + vote.value, 0);
      const scoreB = b.votes.reduce((acc, vote) => acc + vote.value, 0);
      return scoreB - scoreA;
    });

    quotes = allQuotes.slice((page - 1) * limit, page * limit);
  } else {
    quotes = await db.quote.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: (() => {
        switch (sort) {
          case "newest":
            return { createdAt: "desc" };
          case "oldest":
            return { createdAt: "asc" };
          default:
            return { createdAt: "desc" };
        }
      })(),
      include: {
        votes: true,
      },
    });
  }

  return {
    quotes: quotes.map((quote) => ({
      id: quote.id,
      createdAt: quote.createdAt,
      score: quote.votes.reduce((acc, vote) => acc + vote.value, 0),
      vote: author
        ? (quote.votes.find((vote) => vote.author === author)?.value ?? 0)
        : 0,
      text: quote.text,
    })),
    totalCount,
    pageCount: Math.ceil(totalCount / limit),
  } satisfies QuotesResponse;
}

export async function searchQuotes(
  query: string,
  limit: number,
  author?: string,
) {
  const db = new PrismaClient();

  const sanitizedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const quotes = await db.quote.findMany({
    where: {
      text: {
        contains: sanitizedQuery,
      },
    },
    take: limit,
    include: {
      votes: true,
    },
  });

  return quotes
    .map((quote) => ({
      id: quote.id,
      text: quote.text,
      createdAt: quote.createdAt,
      score: quote.votes.reduce((acc, vote) => acc + vote.value, 0),
      vote: author
        ? (quote.votes.find((vote) => vote.author === author)?.value ?? 0)
        : 0,
    }))
    .sort((a, b) => b.score - a.score);
}
