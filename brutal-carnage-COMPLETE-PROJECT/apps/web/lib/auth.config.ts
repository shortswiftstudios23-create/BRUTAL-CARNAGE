// lib/auth.config.ts
// Edge-runtime-safe subset of the auth config, used ONLY by middleware.ts.
//
// middleware.ts runs on the Edge runtime, which cannot run Prisma or
// bcrypt (both are Node.js-only). The full config in auth.ts pulls in
// PrismaAdapter + bcryptjs, so importing it into middleware crashes
// every single request the middleware touches — which is effectively
// every page, since the matcher covers the whole app. That crash was
// surfacing as pages (including /login itself) 404ing.
//
// This file has NO adapter and NO database calls. It only knows how to
// read/shape the JWT already issued by the full config in auth.ts (which
// runs in normal serverless Node functions, e.g. the OAuth callback route
// and Server Actions) — exactly what middleware needs to decide "is this
// user logged in, blacklisted, what's their rank" without touching Prisma.

import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [], // providers are only needed where sign-in actually happens (auth.ts)
  callbacks: {
    // Same shape as the session callback in auth.ts — kept in sync so
    // session.user.rank / isBlacklisted are readable in middleware.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.rank = token.rank as any;
        session.user.isBlacklisted = token.isBlacklisted as boolean;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
        session.user.discordId = token.discordId as string;
      }
      return session;
    },
  },
};
