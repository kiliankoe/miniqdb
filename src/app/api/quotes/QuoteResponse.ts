export type QuoteResponse = {
  id: number;
  createdAt: Date;
  score: number;
  vote: number;
  text: string | null;
};

export type QuotesResponse = {
  quotes: QuoteResponse[];
  totalCount: number;
  pageCount: number;
};
