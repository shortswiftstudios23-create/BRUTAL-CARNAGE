// app/(auth)/login/page.tsx
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-white">Brutal Carnage</h1>
        <p className="mb-8 text-sm text-neutral-400">
          Sign in with your Discord account to continue.
        </p>
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
