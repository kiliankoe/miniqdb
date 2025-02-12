import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  const token = await getToken({ req: request, secret });
  console.log(token);
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
