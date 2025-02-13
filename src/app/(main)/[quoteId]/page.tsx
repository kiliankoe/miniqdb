"use client";

import { Loading } from "@/shared/Loading";
import { QuoteView } from "@/shared/QuoteView";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function QuotePage() {
  const { quoteId } = useParams();
  const {
    data: quote,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: async () => {
      const res = await fetch(`/api/quotes/${quoteId}`);
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error(`Failed to fetch quote: ${res.statusText}`);
      }
      return await res.json();
    },
  });

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (isLoading) {
    return <Loading />;
  }

  if (!quote) {
    return <div>Quote not found</div>;
  }

  return <QuoteView quote={quote} />;
}
