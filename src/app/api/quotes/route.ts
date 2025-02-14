import { NextResponse, type NextRequest } from "next/server";
import { getQuotes } from "./GetQuotes";
import { SortOpts, type Sort } from "./Sort";
import { addQuote } from "./AddQuote";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/authOptions";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  const params = await request.nextUrl.searchParams;

  const page = params.get("page") ?? "1";
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

  const resp = await getQuotes(sort as Sort, parseInt(page), parseInt(limit), session?.user?.email ?? undefined);
  return NextResponse.json(resp);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (body.quote === undefined) {
    return NextResponse.json({ error: "Expected quote" }, { status: 400 });
  }
  if (body.quote.length < 5 || body.quote.length > 1000) {
    return NextResponse.json({ error: "Quote must be between 5 and 1000 characters" }, { status: 400 });
  }

  await addQuote(body.quote, session.user.email);
  return NextResponse.json({ message: "Quote added" });
}
