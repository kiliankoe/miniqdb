import { NextResponse, type NextRequest } from "next/server";

export async function PUT(request: NextRequest) {
  const params = await request.nextUrl.searchParams;
  const quoteId = params.get("quoteId");
  const authorId = params.get("authorId");
  const vote = params.get("vote");
  if (vote !== "1" && vote !== "-1") {
    return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
  }
  console.log(quoteId, authorId, vote);
  // const quote = await getQuote(quoteId);
  // const updatedQuote = await updateQuote(quoteId, { vote });
  // return NextResponse.json(updatedQuote);
  return NextResponse.json({ quoteId, authorId, vote });
}
