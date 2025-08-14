import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../[...nextauth]/authOptions";

export async function GET() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.email === process.env.ADMIN_EMAIL;

  return NextResponse.json({ isAdmin });
}
