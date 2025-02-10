// import { getQuote } from "../api/quotes/GetQuote";

export default async function QuotePage({ params }: { params: { quoteId: string } }) {
  // const quote = await getQuote(params.quoteId);
  return <div>{params.quoteId}</div>;
}
