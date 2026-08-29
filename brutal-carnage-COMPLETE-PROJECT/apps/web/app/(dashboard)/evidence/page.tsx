// app/(dashboard)/evidence/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { EvidenceClient } from "./evidence-client";

export default async function EvidencePage() {
  const session = await auth();
  if (!can(session!.user.rank, "canViewReports")) redirect("/dashboard");

  const userId = session!.user.id;
  const [files, unreadCount] = await Promise.all([
    prisma.evidenceFile.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  const uploaderIds = [...new Set(files.map((f) => f.uploadedById))];
  const uploaders = await prisma.user.findMany({
    where: { id: { in: uploaderIds } },
    select: { id: true, username: true },
  });
  const uploaderMap = new Map(uploaders.map((u) => [u.id, u.username]));

  return (
    <>
      <Topbar pageTitle="Evidence Locker" notificationCount={unreadCount} />
      <main className="flex-1 overflow-y-auto p-6">
        <EvidenceClient
          files={files.map((f) => ({
            id: f.id,
            url: f.url,
            type: f.type as "video" | "image",
            relatedReportId: f.relatedReportId,
            uploadedBy: uploaderMap.get(f.uploadedById) ?? "Unknown",
            createdAt: f.createdAt.toISOString(),
          }))}
        />
      </main>
    </>
  );
}
