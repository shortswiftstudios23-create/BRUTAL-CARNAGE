// app/api/performance/recompute/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { recomputePerformance } from "@/lib/performance";

// Also called by the bot's nightly cron with a service-role bypass — see
// the connection guide's env var section for PERFORMANCE_CRON_SECRET.
export async function POST(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret");
  const isCron = cronSecret && cronSecret === process.env.PERFORMANCE_CRON_SECRET;

  if (!isCron) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!can(session.user.rank, "canViewDetailedLogs")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const result = await recomputePerformance();
  return NextResponse.json({ success: true, ...result });
}
