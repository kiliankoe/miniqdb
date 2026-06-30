import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPb } from "./pocketbase";
import type {
  QuoteRecord,
  QuoteWithVote,
  QuotesPage,
  Sort,
  VoteRecord,
  WebhookRecord,
} from "./types";

export function getSortString(sort: Sort): string {
  switch (sort) {
    case "newest":
      return "-created";
    case "oldest":
      return "+created";
    case "top":
      return "-score,-created";
    case "random":
      return "@random";
  }
}

// Escape a literal string for use inside a PocketBase filter `"..."`
// expression. Backslash is the escape char, so it must be escaped first,
// then the surrounding quotes.
export function escapeFilterString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function enrichWithVotes(
  quotes: QuoteRecord[],
): Promise<QuoteWithVote[]> {
  const pb = getPb();
  const user = pb.authStore.record;
  if (!user || quotes.length === 0) {
    return quotes.map((q) => ({ ...q, vote: 0 }));
  }

  const quoteFilter = quotes.map((q) => `quote = "${q.id}"`).join(" || ");
  try {
    const votes = await pb.collection("votes").getFullList<VoteRecord>({
      filter: `author = "${user.email}" && (${quoteFilter})`,
    });
    const voteMap = new Map(votes.map((v) => [v.quote, v.value]));
    return quotes.map((q) => ({ ...q, vote: voteMap.get(q.id) ?? 0 }));
  } catch {
    return quotes.map((q) => ({ ...q, vote: 0 }));
  }
}

export function useQuotes(sort: Sort, page: number, limit: number) {
  return useQuery<QuotesPage>({
    queryKey: ["quotes", sort, page, limit],
    queryFn: async () => {
      const pb = getPb();
      const result = await pb
        .collection("quotes")
        .getList<QuoteRecord>(page, limit, {
          sort: getSortString(sort),
        });
      const quotes = await enrichWithVotes(result.items);
      return {
        quotes,
        totalCount: result.totalItems,
        pageCount: result.totalPages,
      };
    },
  });
}

export function useQuote(shortId: string) {
  return useQuery({
    queryKey: ["quote", shortId],
    queryFn: async () => {
      const pb = getPb();
      const result = await pb
        .collection("quotes")
        .getFirstListItem<QuoteRecord>(`shortId = ${shortId}`);
      const enriched = await enrichWithVotes([result]);
      return enriched[0];
    },
  });
}

export function useRandomQuotes(count: number) {
  return useQuery<QuoteRecord[]>({
    queryKey: ["quotes", "random-examples", count],
    queryFn: async () => {
      const pb = getPb();
      const result = await pb
        .collection("quotes")
        .getList<QuoteRecord>(1, count, {
          sort: "@random",
        });
      return result.items;
    },
    // Keep the same examples for the session rather than reshuffling on refocus.
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSearchQuotes(query: string) {
  return useQuery({
    queryKey: ["quotes", "search", query],
    queryFn: async () => {
      const pb = getPb();
      const result = await pb.collection("quotes").getList<QuoteRecord>(1, 50, {
        filter: `text ~ "${escapeFilterString(query)}"`,
        sort: "-score",
      });
      return enrichWithVotes(result.items);
    },
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function useSubmitQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      const pb = getPb();
      return pb.collection("quotes").create({
        text,
        author: pb.authStore.record?.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}

export function useVote(quoteId: string, currentVote: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newVote: number) => {
      const pb = getPb();
      const email = pb.authStore.record?.email;
      if (!email) throw new Error("Not authenticated");

      if (newVote === 0) {
        try {
          const existing = await pb
            .collection("votes")
            .getFirstListItem(`quote = "${quoteId}" && author = "${email}"`);
          await pb.collection("votes").delete(existing.id);
        } catch {
          // No existing vote to delete
        }
      } else {
        try {
          const existing = await pb
            .collection("votes")
            .getFirstListItem(`quote = "${quoteId}" && author = "${email}"`);
          await pb.collection("votes").update(existing.id, { value: newVote });
        } catch {
          await pb.collection("votes").create({
            quote: quoteId,
            author: email,
            value: newVote,
          });
        }
      }
    },
    onMutate: async (newVote: number) => {
      await queryClient.cancelQueries({ queryKey: ["quotes"] });
      await queryClient.cancelQueries({ queryKey: ["quote"] });

      const previousStates: Array<{
        queryKey: readonly unknown[];
        data: unknown;
      }> = [];

      // Update all cached quote lists
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ["quotes"] })
        .forEach((query) => {
          const data = queryClient.getQueryData<QuotesPage>(query.queryKey);
          if (data?.quotes) {
            previousStates.push({ queryKey: query.queryKey, data });
            queryClient.setQueryData<QuotesPage>(query.queryKey, (old) => {
              if (!old?.quotes) return old;
              return {
                ...old,
                quotes: old.quotes.map((q) =>
                  q.id === quoteId
                    ? {
                        ...q,
                        score: q.score + (newVote - currentVote),
                        vote: newVote,
                      }
                    : q,
                ),
              };
            });
          }
        });

      // Update single quote cache
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ["quote"] })
        .forEach((query) => {
          const data = queryClient.getQueryData<QuoteWithVote>(query.queryKey);
          if (data && data.id === quoteId) {
            previousStates.push({ queryKey: query.queryKey, data });
            queryClient.setQueryData<QuoteWithVote>(query.queryKey, (old) => {
              if (!old) return old;
              return {
                ...old,
                score: old.score + (newVote - currentVote),
                vote: newVote,
              };
            });
          }
        });

      // Update search results
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ["quotes", "search"] })
        .forEach((query) => {
          const data = queryClient.getQueryData<QuoteWithVote[]>(
            query.queryKey,
          );
          if (data) {
            previousStates.push({ queryKey: query.queryKey, data });
            queryClient.setQueryData<QuoteWithVote[]>(query.queryKey, (old) => {
              if (!old) return old;
              return old.map((q) =>
                q.id === quoteId
                  ? {
                      ...q,
                      score: q.score + (newVote - currentVote),
                      vote: newVote,
                    }
                  : q,
              );
            });
          }
        });

      return { previousStates };
    },
    onError: (_err, _newVote, context) => {
      if (context?.previousStates) {
        for (const { queryKey, data } of context.previousStates) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const pb = getPb();
      return pb.collection("quotes").update(id, { text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote"] });
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const pb = getPb();
      return pb.collection("quotes").delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote"] });
    },
  });
}

export function useIsAdmin() {
  const pb = getPb();
  const user = pb.authStore.record;
  return useQuery({
    queryKey: ["admin", user?.email],
    queryFn: () => {
      if (!user) return false;
      return user.isAdmin === true;
    },
    enabled: !!user,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useWebhooks() {
  return useQuery<WebhookRecord[]>({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const pb = getPb();
      return pb.collection("webhooks").getFullList<WebhookRecord>({
        sort: "-created",
      });
    },
  });
}

export function useAddWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (url: string) => {
      const pb = getPb();
      return pb.collection("webhooks").create({ url, active: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });
}

export function useToggleWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const pb = getPb();
      return pb.collection("webhooks").update(id, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const pb = getPb();
      return pb.collection("webhooks").delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });
}
