// lib/auth.ts
// NextAuth v5 (Auth.js) — Discord-only provider, custom credential bridge
// for bot-issued temp passwords, and rank injected into the session.

import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { Rank } from "@prisma/client";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    // Primary path: Discord OAuth. This is the ONLY way members are
    // expected to sign in day-to-day. Discord identity is the source
    // of truth; we just look up the matching User row by discordId.
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: "identify email guilds guilds.members.read" } },
    }),

    // Secondary path: used ONLY the very first time a brand-new member
    // signs in with the temp username/password the bot DM'd them, in
    // case they land on the site before completing Discord OAuth, or
    // as a fallback login method if Discord OAuth is ever unavailable.
    // Successful login here still requires an existing bot-provisioned
    // User row — this never creates new accounts.
    Credentials({
      id: "credentials",
      name: "Temporary Credentials",
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
    // Gate sign-in: block blacklisted members and members with no
    // provisioned account (i.e. never joined Discord / bot never ran).
    async signIn({ user, account }) {
      if (account?.provider === "discord") {
        const discordId = (account.providerAccountId ?? "") as string;
        const existing = await prisma.user.findUnique({ where: { discordId } });

        if (!existing) {
          // No account yet. Normally the bot creates this on guildMemberAdd.
          // If someone reaches OAuth without that having fired (e.g. they
          // authorized the app without being in the Discord server), deny.
          return "/login?error=NoFamilyAccount";
        }
        if (existing.isBlacklisted) {
          return "/login?error=Blacklisted";
        }
      }
      return true;
    },

    // Always refresh rank + blacklist status into the JWT on each
    // request so a Discord role change / promotion reflects immediately
    // without forcing a re-login.
    async jwt({ token, user, account }) {
      let discordId: string | undefined;

      if (account?.provider === "discord") {
        discordId = account.providerAccountId as string;
      } else if (user && "id" in user) {
        // credentials path — id is our internal User.id already
        const dbUser = await prisma.user.findUnique({ where: { id: user.id as string } });
        discordId = dbUser?.discordId;
      }

      if (discordId) {
        const dbUser = await prisma.user.findUnique({ where: { discordId } });
        if (dbUser) {
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
      if (session.user) {
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
