import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isUserAdmin } from "../[...nextauth]/authOptions";

export async function GET() {
  const session = await getServerSession(authOptions);
  const isAdmin = isUserAdmin(session?.user?.email);

  return NextResponse.json({ isAdmin });
}
