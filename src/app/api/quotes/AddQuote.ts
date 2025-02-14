import { PrismaClient } from "@prisma/client";

export async function addQuote(quoteText: string, author: string) {
  const prisma = new PrismaClient();
  const quote = await prisma.quote.create({
    data: {
      text: quoteText,
      author,
    },
  });
  await prisma.vote.create({
    data: {
      quoteId: quote.id,
      value: 1,
      author,
    },
  });
  return quote;
}
