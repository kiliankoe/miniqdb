import React from "react";
import { getQuotes } from "./api/quotes/GetQuotes";
import { QuoteView } from "./QuoteView";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const page = parseInt((searchParams.page ?? "0") as string);
  const limit = parseInt((searchParams.limit ?? "10") as string);
  const quotes = await getQuotes("newest", page, limit);

  return (
    <div>
      <ul>
        {quotes?.quotes.map((quote) => (
          <li key={quote.id} className="my-8">
            <QuoteView quote={quote} />
          </li>
        ))}
      </ul>
    </div>
  );
}
