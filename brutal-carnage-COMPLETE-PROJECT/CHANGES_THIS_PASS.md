# Changes made in this pass (round 2)

## Nickname format on every role grant
New helper `buildServerNickname(rank, name, gameId)`
(`apps/web/lib/rankLabels.ts` / `bot/src/lib/nickname.ts`) builds
`Rank | Name | ID` (e.g. `Cadet | Denver Jiii | 189119`), falling back
to short rank codes (EM, BM, UD, Dep, BB, etc.) and finally trimming
the name if the full string would exceed Discord's 32-character
nickname limit. Added `User.gameName` (their typed in-game name,
separate from the generated website login `username`) via a new
migration to support this.

## Promotion messages
- Dropped the separate `**ID:**` line from both the request and the
  approval messages — the member's server nickname (now always kept
  in sync) already shows their ID whenever they're @mentioned, so it
  was redundant.
- On approval, the announcement now posts to **both**
  `promotion-demotion` and `family-rank-request` (previously only the
  approvals channel got a message; the request channel just sat there
  with no resolution shown).
- On approval, the bot also now sets the member's Discord role **and**
  nickname in the same API call (`syncDiscordRoleForPromotion`).

## New: role-request channel (`1542488940882305096`)
New handler in `bot/src/events/messageCreate.ts` (`handleRoleRequest`)
watches this channel for the `Name / ID / Rank / Proof` template
(rank can be typed as `3 Cadet` or just `Cadet` — the leading number
is stripped). On a valid request it:
- Saves `gameId` + `gameName` to the member's account (refuses if that
  ID is already claimed by someone else).
- Assigns the matching Discord rank role and sets their nickname to
  `Rank | Name | ID`.
- Replies confirming what was applied.

This reuses the existing role→DB rank sync (`guildMemberUpdate.ts`),
so first-time role grants through this channel still trigger the
normal website-credentials DM the same as a manual role assignment
would.

---
Unzip this over your existing project folder (it only touches the files
listed below — nothing else was moved or deleted).

## 1. Logout
`apps/web/components/layout/sidebar.tsx` — the user button at the bottom
of the sidebar had no click handler at all. It now opens a small menu
with a working "Log out" button (calls NextAuth's `signOut()`).

## 2. Logo
- Your re-uploaded logo file was actually a JPEG saved with a `.png`
  extension — that mismatch is the most likely cause of it silently
  failing to render. Replaced `apps/web/public/logo.png` with a real
  PNG re-encoded from the file you sent.
- Sidebar logo (`sidebar.tsx`) and login page (new
  `apps/web/app/(auth)/login/login-logo.tsx`, wired into
  `apps/web/app/(auth)/login/page.tsx`) now both have `onError`
  fallbacks — if the image ever fails to load for any reason, you'll
  see a "BC" badge instead of a broken image icon, so it never just
  vanishes silently again.

## 3 & 4. Discord promotion-request channel (`1542487057782276167`)
`apps/web/lib/discord.ts` (`postPromotionRequestToDiscord`) and
`bot/src/events/messageCreate.ts`:
- ID is now always pulled from the requester's website profile
  (`User.gameId`, matched via their Discord account) — never taken
  from typed text, so it can't be spoofed/mistyped and won't show
  "n/a" unless that member genuinely has no game ID saved.
- Reason capture now reads everything after `Reason:` up to the next
  known field label or end of message, so multi-line/long reasons are
  captured in full instead of stopping at the first line.
- A `@mention` of the requester is now appended below the reason.
- The Discord → Website sync itself (creating a real `PromotionRequest`
  row that shows up in the Admin panel, approvable from the site) was
  already implemented — it just used to trust a typed ID line. It now
  matches purely on the poster's real Discord account.

## 5. Promotion-approved channel (`1542487057316712504`)
`apps/web/lib/discord.ts` (`announcePromotionApproved`) and
`apps/web/app/api/promotions/[id]/approve/route.ts` — the announcement
now includes the promoted member's ID, a mention, previous/new rank,
the original reason, and "Promoted by: @admin".

## 6. Discord ID on the Members page
`apps/web/app/api/members/route.ts` + `members-client.tsx` — added a
"Discord ID" column (click to copy). Sourced from the `discordId`
already stored on each account from login, rather than parsing the
role-request channel — every member already has this set reliably
the moment they first log in, so it can't drift or be missing the way
a channel-scrape could.

## 7. Rank-based approval restrictions
No change needed — `apps/web/lib/permissions.ts`'s
`canApprovePromotionTo()` already enforces: nobody can approve a
promotion to their own rank or above, except Big Boss.

---

**Not verified by a real build** — this sandbox couldn't reach the
Prisma binary CDN to run a full `npm install` / `tsc` check, so please
run `npm run build` (or at least `npx tsc --noEmit`) in `apps/web` and
`bot` after dropping these files in, and paste me any errors.
