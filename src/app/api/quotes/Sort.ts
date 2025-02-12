export const SortOpts = ["newest", "oldest", "top", "random"] as const;
export type Sort = (typeof SortOpts)[number];
