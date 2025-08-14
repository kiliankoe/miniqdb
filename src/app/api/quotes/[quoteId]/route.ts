import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { type NextRequest, NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { getQuote } from "../GetQuotes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.email === process.env.ADMIN_EMAIL;
  const { quoteId } = await params;

  const quote = await getQuote(quoteId, session?.user?.email ?? undefined);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
  return NextResponse.json({ quote, isAdmin });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { quoteId } = await params;
  const body = await request.json();

  if (!body.text || typeof body.text !== "string") {
    return NextResponse.json({ error: "Invalid text" }, { status: 400 });
  }

  const db = new PrismaClient();

  try {
    const updatedQuote = await db.quote.update({
      where: { id: parseInt(quoteId) },
      data: { text: body.text },
    });

    return NextResponse.json(updatedQuote);
  } catch {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
}
