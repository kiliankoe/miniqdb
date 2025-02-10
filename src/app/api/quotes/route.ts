import { NextResponse, type NextRequest } from "next/server";
import { getQuotes } from "./GetQuotes";
import type { Sort } from "./Sort";
import { SortOpts } from "./Sort";

export async function GET(request: NextRequest) {
  const params = await request.nextUrl.searchParams;

  const page = params.get("page") ?? "0";
  if (isNaN(parseInt(page)) || parseInt(page) < 0) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }

  const limit = params.get("limit") ?? "10";
  if (isNaN(parseInt(limit)) || parseInt(limit) <= 0) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }

  const sort = params.get("sort") ?? "newest";
  if (!SortOpts.includes(sort as Sort)) {
    return NextResponse.json({ error: "Invalid sort" }, { status: 400 });
  }

  const resp = await getQuotes(sort as Sort, parseInt(page), parseInt(limit));
  return NextResponse.json(resp);
}
