// app/(auth)/login/page.tsx
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import Image from "next/image";

// Human-readable copy for every error code the sign-in action or
// middleware can send this page.
const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin:
    "Incorrect username or password. If you're a new member, check your Discord DMs — the bot sends your login the moment you join the server or get your first role.",
  Blacklisted:
    "This account has been blacklisted from Brutal Carnage and cannot sign in.",
  Forbidden: "You don't have permission to access that page.",
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

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        username: formData.get("username"),
        password: formData.get("password"),
        redirectTo: "/dashboard",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        return; // NextAuth's own redirect below handles the error param
      }
      throw err;
    }
  }

  return (
    <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Ambient crimson glow behind the card, plus the crest ghosted
          large in the background — brand presence without needing a
          full photographic hero image. */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-crimson-dark/20 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06]">
        <Image src="/logo.png" alt="" fill className="object-contain scale-150" priority />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-crimson-dark/50 shadow-glow-crimson">
            <Image src="/logo.png" alt="Brutal Carnage" fill className="object-cover" priority sizes="64px" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-3xl tracking-wide text-zinc-50">BRUTAL CARNAGE</h1>
            <p className="text-[11px] uppercase tracking-widest2 text-zinc-500">Grand RP · Family System</p>
          </div>
        </div>

        <div className="panel-solid rounded-2xl p-8 shadow-panel">
          <p className="mb-6 text-center text-sm text-zinc-400">
            Sign in with the username and password your Discord DM gave you.
          </p>

          {errorMessage && (
            <div className="mb-6 rounded-lg border border-red-900 bg-red-950/50 p-3 text-left text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          <form action={login} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-xs font-medium uppercase tracking-widest2 text-zinc-500"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                className="w-full rounded-lg border border-panel-border bg-black/25 px-3 py-2.5 text-white placeholder-zinc-600 transition-colors focus:border-crimson-dark focus:outline-none focus:ring-1 focus:ring-crimson-dark"
                placeholder="your-username"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-medium uppercase tracking-widest2 text-zinc-500"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-panel-border bg-black/25 px-3 py-2.5 text-white placeholder-zinc-600 transition-colors focus:border-crimson-dark focus:outline-none focus:ring-1 focus:ring-crimson-dark"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-gradient-to-r from-crimson-dark to-crimson px-4 py-3 font-medium text-white shadow-glow-crimson transition hover:brightness-110 active:brightness-95"
            >
              Sign In
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Don't have an account? Join the Brutal Carnage Discord server —
          your login is sent to you automatically by DM.
        </p>
      </div>
    </div>
  );
}
