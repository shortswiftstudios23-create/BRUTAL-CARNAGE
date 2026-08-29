// app/(auth)/login/page.tsx
import { signIn } from "@/lib/auth";

// Human-readable copy for every error code the auth callbacks/middleware
// can redirect here with. Without this map the login page silently
// re-renders on failure and it LOOKS like clicking "Login with Discord"
// did nothing, when really Discord auth is failing for a specific,
// diagnosable reason.
const ERROR_MESSAGES: Record<string, string> = {
  NoFamilyAccount:
    "No Brutal Carnage account found for your Discord account. You need to join the Discord server first — the bot creates your account automatically the moment you join. If you already joined, make sure the Discord bot is running and connected (check the bot's terminal for errors).",
  Blacklisted:
    "This account has been blacklisted from Brutal Carnage and cannot sign in.",
  Forbidden:
    "You don't have permission to access that page.",
  Configuration:
    "Discord sign-in is misconfigured on the server (check DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET / redirect URI in the Discord Developer Portal).",
  AccessDenied: "Access was denied by Discord.",
  Verification: "That sign-in link is invalid or has expired.",
  Default: "Something went wrong signing in. Please try again.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const errorCode = searchParams?.error;
  const errorMessage = errorCode
    ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-white">Brutal Carnage</h1>
        <p className="mb-8 text-sm text-neutral-400">
          Sign in with your Discord account to continue.
        </p>

        {errorMessage && (
          <div className="mb-6 rounded-lg border border-red-900 bg-red-950/50 p-3 text-left text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("discord", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-[#5865F2] px-4 py-3 font-medium text-white transition hover:bg-[#4752c4]"
          >
            Login with Discord
          </button>
        </form>
      </div>
    </div>
  );
}
