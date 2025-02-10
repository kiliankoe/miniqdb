import { getQuotes } from "./api/quotes/GetQuotes";
export default async function HomePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const page = parseInt(searchParams.page as string);
  const limit = parseInt(searchParams.limit as string);
  const quotes = await getQuotes("newest", page, limit);

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
