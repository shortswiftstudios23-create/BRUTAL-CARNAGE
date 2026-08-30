// app/(dashboard)/settings/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();
  const [user, unreadCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { username: true, mustChangePassword: true },
    }),
    prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
  ]);

  return (
    <>
      <Topbar pageTitle="Account settings" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <SettingsClient currentUsername={user!.username} mustChangePassword={user!.mustChangePassword} />
      </main>
    </>
  );
}
