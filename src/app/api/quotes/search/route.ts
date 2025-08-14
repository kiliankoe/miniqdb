import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isUserAdmin } from "../../auth/[...nextauth]/authOptions";
import { searchQuotes } from "../GetQuotes";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const isAdmin = isUserAdmin(session?.user?.email);
  const params = request.nextUrl.searchParams;

  const query = params.get("q");
  if (!query) {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 },
    );
  }

  const limit = params.get("limit") ?? "20";
  if (isNaN(parseInt(limit)) || parseInt(limit) <= 0) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }

  try {
    const quotes = await searchQuotes(
      query,
      parseInt(limit),
      session?.user?.email ?? undefined,
    );
    return NextResponse.json({ quotes, isAdmin });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search quotes" },
      { status: 500 },
    );
  }
}
