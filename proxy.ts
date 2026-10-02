import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasSessionCookie, isProtectedPath } from "@/platform/auth/cookies";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname) && !hasSessionCookie(request.headers.get("cookie"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/employee/:path*", "/settings/:path*"],
};
