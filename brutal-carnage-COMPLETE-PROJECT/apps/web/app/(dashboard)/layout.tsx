// app/(dashboard)/layout.tsx
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  });

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-[#0A0A0B]">
        <Sidebar
          userRank={session.user.rank}
          username={session.user.name ?? "Member"}
          avatarUrl={session.user.image}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </SidebarProvider>
  );
}
