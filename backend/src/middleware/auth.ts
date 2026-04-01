import { createMiddleware } from "hono/factory";
import { createHash } from "node:crypto";
import { db } from "../db";

type AuthVariables = {
  userId: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Extracts and validates Bearer token from the Authorization header.
 * Sets c.var.userId on success; returns 401 on failure.
 * Also updates lastSeenAt on the session.
 */
export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
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
      // Clean up expired session
      await db.userSession.delete({ where: { id: session.id } }).catch(() => {});
      return c.json(
        { error: { message: "Token expired", code: "TOKEN_EXPIRED" } },
        401
      );
    }

    // Block suspended or inactive accounts
    if (session.user.status === "SUSPENDED" || session.user.status === "DISABLED") {
      return c.json(
        { error: { message: "Account suspended", code: "ACCOUNT_SUSPENDED" } },
        401
      );
    }

    // Update lastSeenAt (fire-and-forget, don't block the request)
    db.userSession
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});

    c.set("userId", session.userId);
    await next();
  }
);
