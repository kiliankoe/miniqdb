import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "../GetQuotes";
import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
export async function GET(request: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  const session = await getServerSession(authOptions);
  const { quoteId } = await params;

  const quote = await getQuote(quoteId, session?.user?.email ?? undefined);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
  return NextResponse.json(quote);
}
