export type Sort = "newest" | "oldest" | "top" | "random";

export interface QuoteRecord {
  id: string;
  text: string;
  author: string;
  shortId: number;
  score: number;
  created: string;
  updated: string;
}

export interface VoteRecord {
  id: string;
  quote: string;
  author: string;
  value: number;
  created: string;
}

export interface WebhookRecord {
  id: string;
  url: string;
  active: boolean;
  created: string;
  updated: string;
}

export interface QuoteWithVote extends QuoteRecord {
  vote: number;
}

export interface QuotesPage {
  quotes: QuoteWithVote[];
  totalCount: number;
  pageCount: number;
}
