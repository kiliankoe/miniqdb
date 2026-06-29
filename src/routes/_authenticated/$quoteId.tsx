import { createFileRoute } from "@tanstack/react-router";
import { Loading } from "@/components/Loading";
import { QuoteView } from "@/components/QuoteView";
import { useQuote, useIsAdmin } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/$quoteId")({
  component: QuotePage,
});

function QuotePage() {
  const { quoteId } = Route.useParams();
  const { data: quote, isLoading, error } = useQuote(quoteId);
  const { data: isAdmin } = useIsAdmin();

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (isLoading) {
    return <Loading />;
  }

  if (!quote) {
    return <div>Quote not found</div>;
  }

  return <QuoteView quote={quote} isAdmin={isAdmin} />;
}
