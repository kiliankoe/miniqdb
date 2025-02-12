export type QuotesResponse = {
  quotes: {
    id: number;
    createdAt: Date;
    score: number;
    text: string | null;
  }[];
  totalCount: number;
  pageCount: number;
};
