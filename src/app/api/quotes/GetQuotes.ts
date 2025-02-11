import { PrismaClient } from "@prisma/client";
import type { QuotesResponse } from "./QuoteResponse";
import type { Sort } from "./Sort";

export async function getQuote(quoteId: string) {
  const db = new PrismaClient();
  const id = parseInt(quoteId);
  const quote = await db.quote.findUnique({
    where: { id },
  });
  if (!quote) {
    return null;
  }
  const votes = await db.vote.findMany({
    where: { quoteId: id },
  });
  return {
    id: quote.id,
    createdAt: quote.createdAt,
    score: votes.reduce((acc, vote) => acc + vote.value, 0),
    text: quote.text,
  };
}

export async function getQuotes(sort: Sort, page: number, limit: number) {
  const db = new PrismaClient();
  const totalCount = await db.quote.count();
  const quotes = await db.quote.findMany({
    skip: (page - 1) * limit,
    take: limit,
    orderBy: {
      createdAt: sort === "newest" ? "desc" : "asc",
    },
    include: {
      _count: {
        select: { votes: true },
      },
      votes: {
        select: {
          value: true,
        },
      },
    },
  });
  return {
    quotes: quotes.map((quote) => ({
      id: quote.id,
      createdAt: quote.createdAt,
      score: quote.votes.reduce((acc, vote) => acc + vote.value, 0),
      text: quote.text,
    })),
    totalCount,
    pageCount: Math.ceil(totalCount / limit),
  } satisfies QuotesResponse;
}
