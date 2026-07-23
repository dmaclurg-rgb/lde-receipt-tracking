import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Gates every page/API route except auth endpoints and the login page
// behind a signed-in, allowlisted session. Named `proxy` (not `middleware`)
// per this Next.js version's renamed file convention.
export default auth((req) => {
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");
  const isLoginPage = req.nextUrl.pathname === "/login";
  if (!req.auth && !isAuthRoute && !isLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
