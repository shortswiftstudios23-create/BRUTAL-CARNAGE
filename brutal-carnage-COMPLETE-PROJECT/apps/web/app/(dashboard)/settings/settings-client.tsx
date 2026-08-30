// app/(dashboard)/settings/settings-client.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, KeyRound, UserCog } from "lucide-react";

export function SettingsClient({
  currentUsername,
  mustChangePassword,
}: {
  currentUsername: string;
  mustChangePassword: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forced = searchParams.get("forced") === "1" || mustChangePassword;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!currentPassword) {
      toast.error("Enter your current password to confirm changes");
      return;
    }
    if (!newUsername.trim() && !newPassword) {
      toast.error("Enter a new username and/or a new password");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    if (newPassword && newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newUsername: newUsername.trim() || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.formErrors?.[0] ?? data.error ?? "Couldn't update account");
        return;
      }
      toast.success("Account updated");
      setCurrentPassword("");
      setNewUsername("");
      setNewPassword("");
      setConfirmPassword("");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Couldn't update account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md">
      {forced && (
        <div className="mb-5 rounded-lg border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-300">
          You're on a temporary password. Set your own username and password to continue.
        </div>
      )}

      <div className="rounded-lg border border-panel-border bg-panel/70 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
          <UserCog className="h-4 w-4" /> Account
        </h2>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-zinc-500">Current username</label>
          <p className="text-sm text-zinc-300">{currentUsername}</p>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-zinc-500">New username (optional)</label>
          <input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Leave blank to keep current"
            className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 flex items-center gap-1 text-xs text-zinc-500">
            <KeyRound className="h-3 w-3" /> New password (optional)
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Leave blank to keep current"
            className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          />
        </div>

        {newPassword && (
          <div className="mb-3">
            <label className="mb-1 block text-xs text-zinc-500">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
            />
          </div>
        )}

        <div className="mb-4 border-t border-panel-border pt-3">
          <label className="mb-1 block text-xs text-zinc-500">Current password (required to confirm)</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 focus:border-red-800 focus:outline-none focus:ring-1 focus:ring-red-800"
          />
        </div>

        <button
          onClick={submit}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-red-800 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </button>
      </div>
    </div>
  );
}
