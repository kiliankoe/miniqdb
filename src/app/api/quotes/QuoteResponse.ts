export type QuotesResponse = {
  quotes: {
    id: number;
    createdAt: Date;
    score: number;
    body: string | null;
    file: string | null;
  }[];
  totalCount: number;
  pageCount: number;
};
