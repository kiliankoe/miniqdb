"use client";

import type { Sort } from "@/app/api/quotes/Sort";
import { Loading } from "@/components/Loading";
import { NewSinceDivider } from "@/components/NewSinceDivider";
import { QuoteView } from "@/components/QuoteView";
import { Pagination } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import type { QuoteResponse } from "../api/quotes/QuoteResponse";

export default function HomePage() {
  const router = useRouter();
  const params = useSearchParams();
  const page = parseInt((params.get("page") ?? "1") as string);
  const limit = parseInt((params.get("limit") ?? "10") as string);
  const sort = (params.get("sort") ?? "newest") as Sort;
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [dividerIndex, setDividerIndex] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["quotes", page, limit, sort],
    queryFn: () =>
      fetch(`/api/quotes?sort=${sort}&page=${page}&limit=${limit}`).then(
        (res) => res.json(),
      ),
  });

  const quotes = data?.quotes;
  const isAdmin = data?.isAdmin;

  // last visit tracking
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only track on the first page with newest sort
    if (page === 1 && sort === "newest") {
      const storedLastVisit = localStorage.getItem("lastVisit");
      setLastVisit(storedLastVisit);

      if (data?.quotes && data.quotes.length > 0) {
        const newestQuoteTime = new Date(
          data.quotes[0].createdAt,
        ).toISOString();
        localStorage.setItem("lastVisit", newestQuoteTime);
      }
    }
  }, [page, sort, data]);

  // calculate last visit divider position
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
      (quote: QuoteResponse) => new Date(quote.createdAt) <= lastVisitDate,
    );

    // Only show divider if there are both new and old quotes
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
        minHeight: "calc(100% - 64px)",
        paddingBottom: "24px",
      }}
    >
      <ul style={{ flexGrow: 1 }}>
        {quotes?.map((quote: QuoteResponse, index: number) => (
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
      {sort !== "random" && data?.pageCount > 1 && (
        <div
          style={{
            marginTop: "auto",
            paddingTop: "24px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Pagination
            count={data?.pageCount ?? 0}
            page={page}
            size="small"
            onChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
