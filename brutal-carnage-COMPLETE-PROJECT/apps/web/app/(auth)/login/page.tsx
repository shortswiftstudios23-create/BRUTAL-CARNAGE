// app/(auth)/login/page.tsx
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

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
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-8">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          Brutal Carnage
        </h1>
        <p className="mb-8 text-center text-sm text-neutral-400">
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
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white placeholder-neutral-500 focus:border-red-700 focus:outline-none"
              placeholder="your-username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white placeholder-neutral-500 focus:border-red-700 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-red-700 px-4 py-3 font-medium text-white transition hover:bg-red-800"
          >
            Sign In
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-500">
          Don't have an account? Join the Brutal Carnage Discord server —
          your login is sent to you automatically by DM.
        </p>
      </div>
    </div>
  );
}
