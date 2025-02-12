import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "../GetQuotes";
export async function GET(request: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const quote = await getQuote(quoteId);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
  return NextResponse.json(quote);
}
