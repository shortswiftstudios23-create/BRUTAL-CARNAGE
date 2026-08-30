// lib/auth.ts
// NextAuth v5 (Auth.js) — username/password only. The bot auto-generates
// a temp password and DMs it to each member (via guildMemberAdd /
// guildMemberUpdate in bot/src), and that's the only way in. No Discord
// OAuth button — removed after repeated OAuth config/deployment issues.

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { Rank } from "@prisma/client";
import { authConfig } from "./auth.config";
import { cache } from "react";

const { handlers, auth: rawAuth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    // Only login path: username + password, both auto-issued by the
    // Discord bot the moment someone joins the server / gets their
    // first role. The bot DMs these credentials privately. This never
    // creates new accounts here — only the bot provisions users.
    Credentials({
      id: "credentials",
      name: "Brutal Carnage Login",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.username || !creds?.password) return null;

        const user = await prisma.user.findFirst({
          where: { username: creds.username as string },
        });
        if (!user || !user.passwordHash) return null;
        if (user.isBlacklisted) return null;

        const valid = await bcrypt.compare(
          creds.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          name: user.username,
          rank: user.rank,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],

  callbacks: {
    // Refresh rank + blacklist status into the JWT on each request so a
    // Discord role change / promotion / blacklist reflects immediately
    // without forcing a re-login.
    async jwt({ token, user }) {
      const userId = (user?.id as string) ?? (token.userId as string);
      if (userId) {
        const dbUser = await prisma.user.findUnique({ where: { id: userId } });
        if (dbUser) {
          if (dbUser.isBlacklisted) {
            // Blacklisted mid-session: strip the token so session() below
            // has nothing valid to return, effectively logging them out
            // on their next request.
            return {};
          }
          token.userId = dbUser.id;
          token.rank = dbUser.rank;
          token.isBlacklisted = dbUser.isBlacklisted;
          token.mustChangePassword = dbUser.mustChangePassword;
          token.discordId = dbUser.discordId;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
        session.user.rank = token.rank as Rank;
        session.user.isBlacklisted = token.isBlacklisted as boolean;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
        session.user.discordId = token.discordId as string;
      }
      return session;
    },
  },
});

export { handlers, signIn, signOut };

// The layout AND every page call auth() for the same incoming request
// (layout needs the session for the sidebar, each page needs it again
// for its own data + Topbar). Without this, that's the jwt() callback's
// prisma.user.findUnique running twice per request. React's cache()
// memoizes by request, so the second call reuses the first's result —
// same DB round-trip count as if only one call happened.
export const auth = cache(rawAuth);
