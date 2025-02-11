"use client";

import { QuoteView, type ClientQuote } from "@/shared/QuoteView";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function QuotePage() {
  const { quoteId } = useParams();
  const { data: quote } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: () => fetch(`/api/quotes/${quoteId}`).then((res) => res.json() as Promise<ClientQuote>),
  });

  console.log(quote);

  if (!quote) {
    return <div>Quote not found</div>;
  }

  return <QuoteView quote={quote} />;
}
