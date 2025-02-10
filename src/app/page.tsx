"use client";

import { useQuery } from "@tanstack/react-query";
import type { QuotesResponse } from "./api/quotes/QuoteResponse";

export default function HomePage() {
  const {
    data: quotes,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const response = await fetch("/api/quotes");
      const quotes = await response.json();
      return quotes as QuotesResponse;
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>qdb</h1>
      <ul>
        {quotes?.quotes.map((quote) => (
          <li key={quote.id}>{quote.body}</li>
        ))}
      </ul>
    </div>
  );
}
