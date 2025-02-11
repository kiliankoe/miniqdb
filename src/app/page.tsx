"use client";

import { Pagination } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { QuoteView, type ClientQuote } from "../shared/QuoteView";

export default function HomePage() {
  const router = useRouter();
  const params = useSearchParams();
  const page = parseInt((params.get("page") ?? "1") as string);
  const limit = parseInt((params.get("limit") ?? "10") as string);
  const { data: quotes } = useQuery({
    queryKey: ["quotes", page, limit],
    queryFn: () => fetch(`/api/quotes?sort=newest&page=${page}&limit=${limit}`).then((res) => res.json()),
  });

  const handlePageChange = (event: React.ChangeEvent<unknown>, newPage: number) => {
    const searchParams = new URLSearchParams(params.toString());
    searchParams.set("page", newPage.toString());
    router.replace(`/?${searchParams.toString()}`);
  };

  return (
    <div className="flex flex-col h-full justify-between gap-6">
      <ul>
        {quotes?.quotes.map((quote: ClientQuote) => (
          <li key={quote.id} className="my-6">
            <QuoteView quote={quote} />
          </li>
        ))}
      </ul>
      <Pagination count={quotes?.pageCount ?? 0} page={page} color="primary" size="small" onChange={handlePageChange} />
    </div>
  );
}
