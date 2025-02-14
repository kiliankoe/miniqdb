import { NextResponse, type NextRequest } from "next/server";
import { submitVote } from "./SubmitVote";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getQuote } from "../../GetQuotes";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { quoteId } = await params;

  const body = await request.json();
  if (body.vote === undefined) {
    return NextResponse.json({ error: "Missing vote" }, { status: 400 });
  }

  if (body.vote !== 1 && body.vote !== 0 && body.vote !== -1) {
    return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
  }
  await submitVote(quoteId, session.user.email, body.vote);
  const quote = await getQuote(quoteId);
  return NextResponse.json(quote);
}
