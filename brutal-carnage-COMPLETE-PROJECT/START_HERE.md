# START HERE — Brutal Carnage Project

This folder is your COMPLETE project, fully assembled from every step
Claude built (responses 1 through 10). Everything is in the real folders
it needs to be in. You do not need to move any files around.

Follow these steps IN ORDER. Do not skip any.

---

## Step 1 — Install Node.js (one time only)

If you don't already have it: go to https://nodejs.org, click the button
that says "LTS", download it, and run the installer clicking "Next" on
everything (defaults are fine).

## Step 2 — Reset your Discord bot secrets (IMPORTANT)

You pasted your real bot token and client secret in a chat earlier, which
means they are no longer safe to use. Before doing anything else:

1. Go to https://discord.com/developers/applications and open your app
2. Click "Bot" in the left sidebar -> click "Reset Token" -> copy the new
   token somewhere safe
3. Click "OAuth2" in the left sidebar -> click "Reset Secret" -> copy the
   new secret somewhere safe

You'll paste these new values into the .env files in Step 4.

## Step 3 — Get a database (Supabase, free)

1. Go to https://supabase.com, sign up free, create a new project
2. Once created, go to Project Settings -> Database -> copy the
   "Connection string" (URI format) — this is your DATABASE_URL

## Step 4 — Create your .env files

In this folder, go into `apps/web`. You'll see a file called
`.env.example`. Make a COPY of it and rename the copy to exactly `.env`
(just a dot and "env", nothing else). Open that new `.env` file in
Notepad and fill in:
- DATABASE_URL — paste the connection string from Step 3
- NEXTAUTH_SECRET — any random 40+ character string (mash your keyboard,
  or ask Claude to generate one for you)
- DISCORD_CLIENT_SECRET — your NEW secret from Step 2
- DISCORD_BOT_TOKEN — your NEW token from Step 2

Then go into the `bot` folder, copy `.env.example` to `.env`, and fill in
the same DATABASE_URL and the same NEW bot token.

## Step 5 — Install and set up the database

Open a terminal: press the Windows key, type "Command Prompt", press Enter.

Type these commands one at a time, pressing Enter after each
(replace `C:\path\to\project` with wherever you put this folder):

```
cd C:\path\to\project\apps\web
npm install
npx prisma migrate dev --name init
```

If that last command asks for a migration name, just press Enter to
accept the default.

## Step 6 — Run the website

Still in that same terminal window:

```
npm run dev
```

Open a browser and go to http://localhost:3000 — you should see the
login page.

Leave this terminal window open. Closing it stops the website.

## Step 7 — Run the Discord bot

Open a SECOND, separate terminal window (Windows key -> Command Prompt
again). Leave the first one running.

```
cd C:\path\to\project\bot
npm install
npm run build
npm start
```

You should see something like "Logged in as Brutal Carnage#1234" printed.

## Step 8 — Test it

Follow the Discord guide from earlier (join with a second Discord
account, check you get a DM with login details, log in on the website).

---

## Step 9 — Import the warehouse spreadsheet + link the 3 admin accounts

This is a one-time step. **Important:** since your site is already live
on Vercel (brutalcarnage.vercel.app) with real accounts and data in it,
this needs to run against your PRODUCTION database — not a fresh local
one — or it'll write the import into the wrong database and you won't
see it on the live site.

1. In Vercel: your project -> Settings -> Environment Variables -> copy
   the value of `DATABASE_URL` (the production one).
2. On your computer, open `apps/web/.env` and temporarily set
   `DATABASE_URL` to that production value (make a note of what it was
   before, if anything, so you can put it back after).
3. In the `apps/web` terminal:
   ```
   npm run seed:warehouse
   ```

This will:
- Link Deadly Mesbah's and Deadly Ocean's game IDs + Boss rank onto
  their **existing** accounts (`mesbahhasin233813` and `stargamermj6063`)
  — their usernames and passwords are left exactly as they are now.
- Create a brand-new account for Deadly Khan (no login existed for him
  yet) as Big Boss, and print his one-time temp password to the
  terminal — **copy it the moment it prints**, that's the only time
  it's shown. Hand it to him privately; he'll be forced to set his own
  username/password on first login.
- Import every donation and withdrawal row from the spreadsheet into
  their history (dated correctly), and load the item catalog + current
  stock from the Stock Reconciliation sheet.

Safe to re-run — it won't duplicate accounts, items, or history if run
more than once. Afterward, set `DATABASE_URL` in `apps/web/.env` back
to whatever it was before (or just leave it — it's only read when you
run commands locally, it doesn't affect what's deployed on Vercel).

## If something errors

Copy the EXACT error message you see in the terminal and send it to
Claude — don't try to interpret it yourself, just paste the whole thing.
