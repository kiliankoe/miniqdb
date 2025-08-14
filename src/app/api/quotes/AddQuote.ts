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

  const activeWebhooks = await prisma.webhook.findMany({
    where: { active: true },
  });

  for (const webhook of activeWebhooks) {
    const isSlackWebhook = webhook.url.includes("hooks.slack.com");

    const quoteUrl = `${process.env.BASE_URL}/${quote.id}`;

    const payload = isSlackWebhook
      ? {
          // Slack webhook format
          text: `New ${process.env.MINIQDB_NAME} quote added: "${quote.text}"`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*New ${process.env.MINIQDB_NAME} quote added*\n>${quote.text}`,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `<${quoteUrl}|Quote #${quote.id}>`,
                },
              ],
            },
          ],
        }
      : {
          event: "quote.created",
          quote: {
            id: quote.id,
            text: quote.text,
            createdAt: quote.createdAt,
          },
        };

    fetch(webhook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((error) => {
      console.error(`Failed to call webhook ${webhook.url}:`, error);
    });
  }

  return quote;
}
