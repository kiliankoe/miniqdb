import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { searchQuotes } from "../GetQuotes";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const params = request.nextUrl.searchParams;

  const query = params.get("q");
  if (!query) {
    return NextResponse.json({ error: "Search query is required" }, { status: 400 });
  }

  const limit = params.get("limit") ?? "20";
  if (isNaN(parseInt(limit)) || parseInt(limit) <= 0) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }

  try {
    const quotes = await searchQuotes(query, parseInt(limit), session?.user?.email ?? undefined);
    return NextResponse.json({ quotes });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Failed to search quotes" }, { status: 500 });
  }
}
