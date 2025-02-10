import { getQuote } from "../api/quotes/GetQuotes";

export default async function QuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const quote = await getQuote(quoteId);
  return (
    <div>
      {quote?.text?.split("\\n").map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}
