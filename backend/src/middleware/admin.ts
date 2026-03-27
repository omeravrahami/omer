import { createMiddleware } from "hono/factory";
import { db } from "../db";

type AdminVariables = {
  userId: string;
};

/**
 * Admin middleware: validates Bearer token AND verifies the user has role === "ADMIN".
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

    const session = await db.userSession.findUnique({
      where: { token },
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
