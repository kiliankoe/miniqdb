import type { QueryClient } from "@tanstack/react-query";
import type { RecordSubscription } from "pocketbase";
import { getPb } from "./pocketbase";
import type { QuoteRecord, QuotesPage, QuoteWithVote } from "./types";

export function subscribeToRealtime(queryClient: QueryClient) {
  const pb = getPb();

  // Subscribe to quote changes (new quotes, score updates, deletions)
  pb.collection("quotes").subscribe("*", (e: RecordSubscription) => {
    const record = e.record as unknown as QuoteRecord;

    if (e.action === "create") {
      // A new quote may belong in any sort order (newest, oldest, top), so
      // invalidate all quote-list caches rather than just "newest".
      queryClient.invalidateQueries({
        queryKey: ["quotes"],
      });
    }

    if (e.action === "update") {
      // Patch the full record into cached quotes. Preserve the current user's
      // own `vote` field, which isn't part of the quote record itself.
      const merge = (q: QuoteWithVote): QuoteWithVote => ({
        ...q,
        ...record,
        vote: q.vote,
      });

      // Update score in all cached quote lists
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ["quotes"] })
        .forEach((query) => {
          queryClient.setQueryData<QuotesPage>(query.queryKey, (old) => {
            if (!old?.quotes) return old;
            return {
              ...old,
              quotes: old.quotes.map((q) =>
                q.id === record.id ? merge(q) : q,
              ),
            };
          });
        });

      // Update single quote cache
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ["quote"] })
        .forEach((query) => {
          queryClient.setQueryData<QuoteWithVote>(query.queryKey, (old) => {
            if (!old || old.id !== record.id) return old;
            return merge(old);
          });
        });

      // Update search results
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ["quotes", "search"] })
        .forEach((query) => {
          queryClient.setQueryData<QuoteWithVote[]>(query.queryKey, (old) => {
            if (!old) return old;
            return old.map((q) => (q.id === record.id ? merge(q) : q));
          });
        });
    }

    if (e.action === "delete") {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    }
  });

  // Subscribe to vote changes to update current user's vote state
  pb.collection("votes").subscribe("*", (e: RecordSubscription) => {
    const userEmail = pb.authStore.record?.email;
    const voteAuthor = (e.record as Record<string, unknown>).author as string;

    // Only care about the current user's own votes
    if (voteAuthor !== userEmail) return;

    // Invalidate to refetch with updated vote state
    queryClient.invalidateQueries({ queryKey: ["quotes"] });
    queryClient.invalidateQueries({ queryKey: ["quote"] });
  });

  return () => {
    pb.collection("quotes").unsubscribe("*");
    pb.collection("votes").unsubscribe("*");
  };
}
