// bot/src/lib/audit.ts
// Every bot-initiated write should leave the same AuditLog trail a
// website-initiated action would, so the "Recent activity" feed and full
// audit trail don't have a blind spot for anything the bot does.

import { prisma } from "./prisma";

export async function logAudit(userId: string | null, action: string, metadata?: Record<string, unknown>) {
  try {
    await prisma.auditLog.create({
      data: { userId, action, metadata: metadata as any },
    });
  } catch (err) {
    // Audit logging should never crash the caller's actual side effect.
    console.error(`[audit] Failed to log "${action}"`, err);
  }
}
