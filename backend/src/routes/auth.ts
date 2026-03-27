import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";
import { env } from "../env";

export const authRoutes = new Hono();

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email: z.string().email("Invalid email format").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric with underscores only")
    .optional(),
  platform: z.enum(["ios", "android", "web"]).optional(),
});

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
  platform: z.enum(["ios", "android", "web"]).optional(),
  deviceName: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

function createExpiryDate(): Date {
  return new Date(Date.now() + THIRTY_DAYS_MS);
}

async function createSessionToken(
  userId: string,
  options?: { platform?: string; deviceName?: string }
): Promise<string> {
  const token = crypto.randomUUID();
  await db.userSession.create({
    data: {
      userId,
      token,
      expiresAt: createExpiryDate(),
      platform: options?.platform ?? null,
      deviceName: options?.deviceName ?? null,
    },
  });
  return token;
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

authRoutes.post(
  "/register",
  zValidator("json", registerSchema),
  async (c) => {
    const { email, password, username, platform } = c.req.valid("json");

    const existingEmail = await db.user.findUnique({ where: { email } });
    if (existingEmail) {
      return c.json(
        { error: { message: "Email already in use", code: "EMAIL_TAKEN" } },
        409
      );
    }

    if (username) {
      const existingUsername = await db.user.findUnique({ where: { username } });
      if (existingUsername) {
        return c.json(
          { error: { message: "Username already taken", code: "USERNAME_TAKEN" } },
          409
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        username: username ?? null,
        role: "USER",
        status: "ACTIVE",
      },
    });

    const token = await createSessionToken(user.id, { platform });

    return c.json(
      {
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            status: user.status,
            lastLoginAt: null,
            isEmailVerified: user.isEmailVerified,
            createdAt: user.createdAt,
          },
        },
      },
      201
    );
  }
);

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

authRoutes.post(
  "/login",
  zValidator("json", loginSchema),
  async (c) => {
    const { identifier, password, platform, deviceName } = c.req.valid("json");

    // Find by email OR username (case-insensitive)
    const normalizedIdentifier = identifier.toLowerCase();
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: normalizedIdentifier },
          { username: { equals: normalizedIdentifier } },
        ],
      },
    });

    if (!user) {
      return c.json(
        { error: { message: "Invalid credentials", code: "INVALID_CREDENTIALS" } },
        401
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return c.json(
        { error: { message: "Invalid credentials", code: "INVALID_CREDENTIALS" } },
        401
      );
    }

    if (user.status === "SUSPENDED") {
      return c.json(
        { error: { message: "Account is suspended", code: "ACCOUNT_SUSPENDED" } },
        403
      );
    }

    if (user.status === "DISABLED") {
      return c.json(
        { error: { message: "Account is disabled", code: "ACCOUNT_DISABLED" } },
        403
      );
    }

    // Update lastLoginAt
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await createSessionToken(user.id, { platform, deviceName });

    return c.json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
          lastLoginAt: new Date(),
          createdAt: user.createdAt,
        },
      },
    });
  }
);

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

authRoutes.post("/logout", async (c) => {
  const authorization = c.req.header("Authorization");
  if (authorization && authorization.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    await db.userSession.deleteMany({ where: { token } }).catch(() => {});
  }
  return c.json({ data: { success: true } });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

authRoutes.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      status: true,
      lastLoginAt: true,
      isEmailVerified: true,
      createdAt: true,
    },
  });

  if (!user) {
    return c.json(
      { error: { message: "User not found", code: "NOT_FOUND" } },
      404
    );
  }

  return c.json({ data: user });
});

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
// ---------------------------------------------------------------------------

authRoutes.post(
  "/forgot-password",
  zValidator("json", forgotPasswordSchema),
  async (c) => {
    const { email } = c.req.valid("json");

    const normalizedEmail = email.toLowerCase();
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      // Security: don't reveal whether email exists
      return c.json({
        data: {
          success: true,
          message: "If this email exists, a reset link was sent",
        },
      });
    }

    // Delete any existing unused reset tokens for this user
    await db.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    // Generate a 32-byte random hex token
    const resetToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + ONE_HOUR_MS);

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt,
      },
    });

    const responseData: {
      success: boolean;
      message: string;
      resetToken?: string;
    } = {
      success: true,
      message: "If this email exists, a reset link was sent",
    };

    // In dev/sandbox, expose the token for testing
    if (env.NODE_ENV !== "production") {
      responseData.resetToken = resetToken;
    }

    return c.json({ data: responseData });
  }
);

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password
// ---------------------------------------------------------------------------

authRoutes.post(
  "/reset-password",
  zValidator("json", resetPasswordSchema),
  async (c) => {
    const { token, newPassword } = c.req.valid("json");

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return c.json(
        { error: { message: "Invalid or unknown token", code: "INVALID_TOKEN" } },
        400
      );
    }

    if (resetToken.usedAt !== null) {
      return c.json(
        { error: { message: "Token has already been used", code: "TOKEN_ALREADY_USED" } },
        400
      );
    }

    if (new Date() > resetToken.expiresAt) {
      return c.json(
        { error: { message: "Token has expired", code: "TOKEN_EXPIRED" } },
        400
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and mark token as used
    await db.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    await db.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    // Delete all sessions for this user (force re-login)
    await db.userSession.deleteMany({ where: { userId: resetToken.userId } });

    return c.json({ data: { success: true } });
  }
);

// ---------------------------------------------------------------------------
// POST /api/auth/change-password (logged-in users only)
// ---------------------------------------------------------------------------

authRoutes.post(
  "/change-password",
  authMiddleware,
  zValidator("json", changePasswordSchema),
  async (c) => {
    const userId = c.get("userId");
    const { currentPassword, newPassword } = c.req.valid("json");

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return c.json(
        { error: { message: "User not found", code: "NOT_FOUND" } },
        404
      );
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatch) {
      return c.json(
        { error: { message: "Current password is incorrect", code: "INVALID_CREDENTIALS" } },
        401
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return c.json({ data: { success: true } });
  }
);
