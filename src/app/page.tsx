import React from "react";
import { getQuotes } from "./api/quotes/GetQuotes";
import { QuoteView } from "../shared/QuoteView";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = parseInt((params.page as string) ?? "0");
  const limit = parseInt((params.limit as string) ?? "10");
  const quotes = await getQuotes("newest", page, limit);

  return (
    <div>
      <ul>
        {quotes?.quotes.map((quote) => (
          <li key={quote.id} className="my-6">
            <QuoteView quote={quote} />
          </li>
        ))}
      </ul>
    </div>
  );
}
