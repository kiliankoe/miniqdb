import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;

  const pathname = request.nextUrl.pathname;

  if (process.env.NODE_ENV === "development" && pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Allow all auth routes managed by next-auth
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow all login routes, e.g. /login, /login/verify-request, /login/error, ...
  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret });

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
