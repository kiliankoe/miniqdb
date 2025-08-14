"use client";

import type { Sort } from "@/app/api/quotes/Sort";
import { Loading } from "@/shared/Loading";
import { QuoteView } from "@/shared/QuoteView";
import { Pagination } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import type { QuoteResponse } from "../api/quotes/QuoteResponse";

export default function HomePage() {
  const router = useRouter();
  const params = useSearchParams();
  const page = parseInt((params.get("page") ?? "1") as string);
  const limit = parseInt((params.get("limit") ?? "10") as string);
  const sort = (params.get("sort") ?? "newest") as Sort;
  const { data: quotes, isLoading } = useQuery({
    queryKey: ["quotes", page, limit, sort],
    queryFn: () =>
      fetch(`/api/quotes?sort=${sort}&page=${page}&limit=${limit}`).then(
        (res) => res.json(),
      ),
  });

  const handlePageChange = (
    event: React.ChangeEvent<unknown>,
    newPage: number,
  ) => {
    const searchParams = new URLSearchParams(params.toString());
    searchParams.set("page", newPage.toString());
    router.replace(`/?${searchParams.toString()}`);
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        gap: "24px",
      }}
    >
      <ul>
        {quotes?.quotes.map((quote: QuoteResponse) => (
          <li key={quote.id} style={{ marginBottom: "24px" }}>
            <QuoteView quote={quote} />
          </li>
        ))}
      </ul>
      {sort !== "random" && quotes?.pageCount > 1 && (
        <Pagination
          count={quotes?.pageCount ?? 0}
          page={page}
          size="small"
          onChange={handlePageChange}
        />
      )}
    </div>
  );
}
