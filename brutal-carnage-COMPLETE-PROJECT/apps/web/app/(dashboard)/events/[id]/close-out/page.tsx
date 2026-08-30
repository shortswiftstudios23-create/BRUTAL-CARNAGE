// app/(dashboard)/events/[id]/close-out/page.tsx
import { Topbar } from "@/components/layout/topbar";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { CloseOutForm } from "./close-out-form";

export default async function CloseOutPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!can(session!.user.rank, "canMarkEventResult")) redirect("/events");

  const event = await prisma.event.findUnique({
    where: { id: params.id },
    include: { registrations: { include: { user: { select: { id: true, username: true } } } } },
  });
  if (!event) notFound();

  return (
    <>
      <Topbar pageTitle={`Close out — ${event.title}`} notificationCount={0} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <CloseOutForm
          eventId={event.id}
          eventTitle={event.title}
          registrations={event.registrations.map((r) => ({ userId: r.user.id, username: r.user.username }))}
        />
      </main>
    </>
  );
}
