import { PrismaClient } from "@prisma/client";
import { getQuote } from "../../GetQuotes";

export async function submitVote(
  quoteId: string,
  authorId: string,
  vote: number,
) {
  const quote = await getQuote(quoteId);
  if (!quote) {
    throw new Error("Quote not found");
  }

  const db = new PrismaClient();

  if (![1, 0, -1].includes(vote)) {
    throw new Error("Invalid vote value. Must be 1, 0, or -1");
  }

  if (vote === 0) {
    await db.vote.deleteMany({
      where: {
        quoteId: quote.id,
        author: authorId,
      },
    });
    return;
  }

  await db.vote.upsert({
    where: {
      quoteId_author: {
        quoteId: Number(quote.id),
        author: authorId,
      },
    },
    create: {
      quoteId: Number(quote.id),
      author: authorId,
      value: vote,
    },
    update: {
      value: vote,
    },
  });
}
