// app/(dashboard)/layout.tsx
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="dark flex h-screen bg-background">
      <Sidebar
        userRank={session.user.rank}
        username={session.user.name ?? "Member"}
        avatarUrl={session.user.image}
      />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
