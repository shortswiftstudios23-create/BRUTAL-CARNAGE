// app/(dashboard)/money/categories/page.tsx
// Boss+ only. Lets admins add new expense/income categories (car
// insurance, license plate, house payment, business profit, etc.) or
// retire old ones, without needing a code deploy. See
// prisma TransactionCategory + api/admin/categories.
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { CategoriesClient } from "./categories-client";

export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user || !can(session.user.rank, "canManageCategories")) {
    redirect("/money");
  }

  const [unreadCount, categories] = await Promise.all([
    prisma.notification.count({ where: { userId: session.user.id, read: false } }),
    prisma.transactionCategory.findMany({
      orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { transactions: true } } },
    }),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar pageTitle="Categories" notificationCount={unreadCount} />
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <CategoriesClient
          initialCategories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            direction: c.direction,
            group: c.group,
            icon: c.icon,
            isActive: c.isActive,
            sortOrder: c.sortOrder,
            usageCount: c._count.transactions,
          }))}
        />
      </div>
    </div>
  );
}
