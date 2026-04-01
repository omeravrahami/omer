import { createMiddleware } from "hono/factory";
import { createHash } from "node:crypto";
import { db } from "../db";

type AdminVariables = {
  userId: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Admin middleware: validates Bearer token (SHA-256 hashed) AND verifies the user has role === "ADMIN".
 * Sets c.var.userId on success.
 */
export const adminMiddleware = createMiddleware<{ Variables: AdminVariables }>(
  async (c, next) => {
    const authorization = c.req.header("Authorization");
    if (!authorization || !authorization.startsWith("Bearer ")) {
      return c.json(
        { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
        401
      );
    }

    const token = authorization.slice(7).trim();
    if (!token) {
      return c.json(
        { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
        401
      );
    }

    const tokenHash = hashToken(token);
    const session = await db.userSession.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!session) {
      return c.json(
        { error: { message: "Invalid or expired token", code: "INVALID_TOKEN" } },
        401
      );
    }

    if (new Date() > session.expiresAt) {
      await db.userSession.delete({ where: { id: session.id } }).catch(() => {});
      return c.json(
        { error: { message: "Token expired", code: "TOKEN_EXPIRED" } },
        401
      );
    }

    // Block suspended or inactive accounts (even admins)
    if (session.user.status === "SUSPENDED" || session.user.status === "DISABLED") {
      return c.json(
        { error: { message: "Account suspended", code: "ACCOUNT_SUSPENDED" } },
        401
      );
    }

    if (session.user.role !== "ADMIN") {
      return c.json(
        { error: { message: "Forbidden: admin access required", code: "FORBIDDEN" } },
        403
      );
    }

    // Update lastSeenAt (fire-and-forget)
    db.userSession
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});

    c.set("userId", session.userId);
    await next();
  }
);
