import { PrismaClient } from "@prisma/client";
import type { QuotesResponse } from "./QuoteResponse";
import type { Sort } from "./Sort";

export async function getQuotes(sort: Sort, page: number, limit: number) {
  const db = new PrismaClient();
  const totalCount = await db.quote.count();
  const quotes = await db.quote.findMany({
    skip: page * limit,
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
      body: quote.body,
      file: quote.file,
    })),
    totalCount,
    pageCount: Math.ceil(totalCount / limit),
  } satisfies QuotesResponse;
}
