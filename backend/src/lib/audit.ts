import { db } from "../db";

export async function auditLog(opts: {
  userId?: string;
  action: string;
  resource: string;
  details?: object;
  ip?: string;
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: opts.userId,
        action: opts.action,
        resource: opts.resource,
        details: opts.details ? JSON.stringify(opts.details) : null,
        ip: opts.ip,
      },
    });
  } catch (e) {
    console.error("[audit] Failed to write audit log:", e);
  }
}
