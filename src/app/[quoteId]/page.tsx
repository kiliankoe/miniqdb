import { QuoteView } from "@/shared/QuoteView";
import { getQuote } from "../api/quotes/GetQuotes";

export default async function QuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const quote = await getQuote(quoteId);

  if (!quote) {
    return <div>Quote not found</div>;
  }

  return <QuoteView quote={quote} />;
}
