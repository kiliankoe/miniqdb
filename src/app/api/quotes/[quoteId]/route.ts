import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { type NextRequest, NextResponse } from "next/server";
import { authOptions, isUserAdmin } from "../../auth/[...nextauth]/authOptions";
import { getQuote } from "../GetQuotes";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const session = await getServerSession(authOptions);
  const isAdmin = isUserAdmin(session?.user?.email);
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

  if (!isUserAdmin(session?.user?.email)) {
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
      where: { id: parseInt(quoteId, 10) },
      data: { text: body.text },
    });

    return NextResponse.json(updatedQuote);
  } catch {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!isUserAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { quoteId } = await params;
  const db = new PrismaClient();

  try {
    await db.vote.deleteMany({
      where: { quoteId: parseInt(quoteId, 10) },
    });
    const deletedQuote = await db.quote.delete({
      where: { id: parseInt(quoteId, 10) },
    });

    return NextResponse.json({
      message: "Quote deleted successfully",
      id: deletedQuote.id,
    });
  } catch {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
}
