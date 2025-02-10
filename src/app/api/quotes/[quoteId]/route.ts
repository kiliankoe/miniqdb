import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "../GetQuotes";
export async function GET(request: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const quote = await getQuote(quoteId);
  return NextResponse.json({ quote });
}
