// middleware.ts
// Route-level gate: unauthenticated users bounce to /login, blacklisted
// members are locked out entirely, and rank-gated route prefixes are
// enforced here so pages don't each need their own redirect logic.

import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";

// IMPORTANT: middleware runs on the Edge runtime, which cannot run
// Prisma or bcrypt. Do NOT import { auth } from "@/lib/auth" here —
// that pulls in the full Node-only config and will crash on every
// request. authConfig (lib/auth.config.ts) is the Edge-safe subset.
const { auth } = NextAuth(authConfig);

// Map route prefixes to the permission required to access them.
// Anything not listed here just requires a signed-in, non-blacklisted user.
const ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  "/discipline": "canViewReports",
  "/discipline/blacklist": "canManageBlacklist",
  "/promotions": "canReviewPromotions",
  "/announcements/manage": "canManageAnnouncements",
  "/inventory/pending": "canApprovePendingItems",
  "/money/requests": "canApproveBankRequests",
};

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const isLoginPage = nextUrl.pathname.startsWith("/login");

  if (!session?.user) {
    if (isLoginPage) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (session.user.isBlacklisted) {
    return NextResponse.redirect(new URL("/login?error=Blacklisted", nextUrl));
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  const matchedPrefix = Object.keys(ROUTE_PERMISSIONS)
    .sort((a, b) => b.length - a.length) // longest/most-specific match first
    .find((prefix) => nextUrl.pathname.startsWith(prefix));

  if (matchedPrefix) {
    const permission = ROUTE_PERMISSIONS[matchedPrefix];
    if (!PERMISSIONS[permission](session.user.rank)) {
      return NextResponse.redirect(new URL("/dashboard?error=Forbidden", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
