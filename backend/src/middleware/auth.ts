import { createMiddleware } from "hono/factory";
import { db } from "../db";

type AuthVariables = {
  userId: string;
};

/**
 * Extracts and validates Bearer token from the Authorization header.
 * Sets c.var.userId on success; returns 401 on failure.
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
      // Clean up expired session
      await db.userSession.delete({ where: { id: session.id } }).catch(() => {});
      return c.json(
        { error: { message: "Token expired", code: "TOKEN_EXPIRED" } },
        401
      );
    }

    c.set("userId", session.userId);
    await next();
  }
);
