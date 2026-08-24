import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Role } from "@prisma/client";

function roleHome(role?: Role) {
  if (role === "ADMIN") return "/admin";
  if (role === "TRAINER") return "/trainer";
  if (role === "TRAINEE") return "/app";
  return "/login";
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;
  const isLoggedIn = !!req.auth;
  const isAuthPage = pathname.startsWith("/login");
  // Certificate verification is for people outside the organisation — a
  // prospective employer checking a code has no account here.
  const isPublicPage = pathname.startsWith("/verify");

  if (!isLoggedIn && !isAuthPage && !isPublicPage) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL(roleHome(role), req.url));
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL(roleHome(role), req.url));
  }

  if (pathname.startsWith("/trainer") && role !== "TRAINER" && role !== "ADMIN") {
    return NextResponse.redirect(new URL(roleHome(role), req.url));
  }

  if (pathname.startsWith("/app") && !role) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
