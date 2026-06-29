import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuotes, useIsAdmin } from "@/lib/queries";
import { Loading } from "@/components/Loading";
import { NewSinceDivider } from "@/components/NewSinceDivider";
import { QuoteView } from "@/components/QuoteView";
import { Pagination } from "@mui/material";
import type { Sort } from "@/lib/types";
import type { QuoteWithVote } from "@/lib/types";
import React, { useEffect, useState } from "react";

interface HomeSearch {
  page?: number;
  limit?: number;
  sort?: Sort;
}

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    page: search.page ? Number(search.page) : undefined,
    limit: search.limit ? Number(search.limit) : undefined,
    sort: search.sort ? (search.sort as Sort) : undefined,
  }),
  component: HomePage,
});

function HomePage() {
  const search = Route.useSearch();
  const page = search.page ?? 1;
  const limit = search.limit ?? 10;
  const sort = search.sort ?? "newest";
  const navigate = useNavigate();
  const { data, isLoading } = useQuotes(sort, page, limit);
  const { data: isAdmin } = useIsAdmin();
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [dividerIndex, setDividerIndex] = useState<number | null>(null);

  const quotes = data?.quotes;

  useEffect(() => {
    if (page === 1 && sort === "newest") {
      const storedLastVisit = localStorage.getItem("lastVisit");
      setLastVisit(storedLastVisit);

      if (quotes && quotes.length > 0) {
        const newestQuoteTime = new Date(quotes[0].created).toISOString();
        localStorage.setItem("lastVisit", newestQuoteTime);
      }
    }
  }, [page, sort, quotes]);

  useEffect(() => {
    if (
      page !== 1 ||
      sort !== "newest" ||
      !lastVisit ||
      !quotes ||
      quotes.length === 0
    ) {
      setDividerIndex(null);
      return;
    }

    const lastVisitDate = new Date(lastVisit);
    const newQuotesCount = quotes.findIndex(
      (quote: QuoteWithVote) => new Date(quote.created) <= lastVisitDate,
    );

    if (newQuotesCount > 0 && newQuotesCount < quotes.length) {
      setDividerIndex(newQuotesCount);
    } else {
      setDividerIndex(null);
    }
  }, [quotes, lastVisit, page, sort]);

  const handlePageChange = (
    _event: React.ChangeEvent<unknown>,
    newPage: number,
  ) => {
    navigate({
      to: "/",
      search: { page: newPage, limit, sort },
    });
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100% - 64px)",
        paddingBottom: "24px",
      }}
    >
      <ul style={{ flexGrow: 1 }}>
        {quotes?.map((quote: QuoteWithVote, index: number) => (
          <React.Fragment key={quote.id}>
            {dividerIndex === index && (
              <li style={{ listStyle: "none" }}>
                <NewSinceDivider />
              </li>
            )}
            <li style={{ marginBottom: "24px" }}>
              <QuoteView quote={quote} isAdmin={isAdmin} />
            </li>
          </React.Fragment>
        ))}
      </ul>
      {sort !== "random" && data && data.pageCount > 1 && (
        <div
          style={{
            marginTop: "auto",
            paddingTop: "24px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Pagination
            count={data.pageCount}
            page={page}
            size="small"
            onChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
