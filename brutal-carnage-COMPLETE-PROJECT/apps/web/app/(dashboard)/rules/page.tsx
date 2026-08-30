// app/(dashboard)/rules/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { RulesClient } from "./rules-client";

export default async function RulesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [rules, unreadCount] = await Promise.all([
    prisma.rule.findMany({ orderBy: { order: "asc" } }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return (
    <>
      <Topbar pageTitle="Family Rules" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <RulesClient
          canEdit={can(session!.user.rank, "canManageAnnouncements")}
          initialRules={rules.map((r) => ({ id: r.id, order: r.order, title: r.title, content: r.content }))}
        />
      </main>
    </>
  );
}
