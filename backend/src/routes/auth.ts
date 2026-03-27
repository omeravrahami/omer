import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";
import { authRateLimit, resetRateLimit } from "../middleware/rate-limit";
import { env } from "../env";
import {
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendWelcomeEmail,
} from "../services/email";

export const authRoutes = new Hono();

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email: z.string().email("פורמט אימייל לא תקין").toLowerCase(),
  password: z
    .string()
    .min(8, "הסיסמה חייבת להכיל לפחות 8 תווים")
    .regex(
      /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      "הסיסמה חייבת להכיל לפחות ספרה אחת או תו מיוחד"
    ),
  username: z
    .string()
    .min(3, "שם המשתמש חייב להכיל לפחות 3 תווים")
    .max(20, "שם המשתמש יכול להכיל לכל היותר 20 תווים")
    .regex(/^[a-zA-Z0-9_]+$/, "שם המשתמש יכול להכיל אותיות, ספרות וקו תחתון בלבד")
    .optional(),
  platform: z.enum(["ios", "android", "web"]).optional(),
  deviceName: z.string().optional(),
});

const loginSchema = z.object({
  identifier: z.string().min(1, "נדרש אימייל או שם משתמש"),
  password: z.string().min(1, "נדרשת סיסמה"),
  platform: z.enum(["ios", "android", "web"]).optional(),
  deviceName: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("פורמט אימייל לא תקין"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "נדרש טוקן"),
  newPassword: z
    .string()
    .min(8, "הסיסמה חייבת להכיל לפחות 8 תווים")
    .regex(
      /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      "הסיסמה חייבת להכיל לפחות ספרה אחת או תו מיוחד"
    ),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "נדרשת סיסמה נוכחית"),
  newPassword: z
    .string()
    .min(8, "הסיסמה החדשה חייבת להכיל לפחות 8 תווים")
    .regex(
      /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      "הסיסמה החדשה חייבת להכיל לפחות ספרה אחת או תו מיוחד"
    ),
});

const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, "שם המשתמש חייב להכיל לפחות 3 תווים")
    .max(20, "שם המשתמש יכול להכיל לכל היותר 20 תווים")
    .regex(/^[a-zA-Z0-9_]+$/, "שם המשתמש יכול להכיל אותיות, ספרות וקו תחתון בלבד")
    .optional(),
  email: z.string().email("פורמט אימייל לא תקין").toLowerCase().optional(),
  displayName: z.string().max(50, "שם התצוגה יכול להכיל לכל היותר 50 תווים").optional(),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, "נדרשת סיסמה לאישור"),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, "נדרש טוקן"),
});

const userSettingsSchema = z.object({
  deviceId: z.string().optional(),
  hourlyRate: z.number().optional(),
  currency: z.string().optional(),
  dailyGoalHours: z.number().optional(),
  weeklyGoalHours: z.number().optional(),
  defaultBreakMinutes: z.number().int().optional(),
  showSalaryOnDashboard: z.boolean().optional(),
  themeMode: z.string().optional(),
  onboardingCompleted: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

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

function getCurrentToken(authHeader: string | undefined): string | null {
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

authRoutes.post(
  "/register",
  authRateLimit,
  zValidator("json", registerSchema),
  async (c) => {
    const { email, password, username, platform, deviceName } = c.req.valid("json");

    const existingEmail = await db.user.findUnique({ where: { email } });
    if (existingEmail) {
      return c.json(
        { error: { message: "כתובת האימייל כבר בשימוש", code: "EMAIL_TAKEN" } },
        409
      );
    }

    if (username) {
      const existingUsername = await db.user.findUnique({ where: { username } });
      if (existingUsername) {
        return c.json(
          { error: { message: "שם המשתמש כבר תפוס", code: "USERNAME_TAKEN" } },
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

    const token = await createSessionToken(user.id, { platform, deviceName });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, username ?? email.split("@")[0] ?? email).catch((err) => {
      console.error("[email] Failed to send welcome email:", err);
    });

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
  authRateLimit,
  zValidator("json", loginSchema),
  async (c) => {
    const { identifier, password, platform, deviceName } = c.req.valid("json");

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
        { error: { message: "פרטי ההתחברות שגויים. בדוק אימייל/שם משתמש וסיסמה.", code: "INVALID_CREDENTIALS" } },
        401
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return c.json(
        { error: { message: "פרטי ההתחברות שגויים. בדוק אימייל/שם משתמש וסיסמה.", code: "INVALID_CREDENTIALS" } },
        401
      );
    }

    if (user.status === "SUSPENDED") {
      return c.json(
        { error: { message: "החשבון מושעה. צור קשר עם התמיכה.", code: "ACCOUNT_SUSPENDED" } },
        403
      );
    }

    if (user.status === "DISABLED") {
      return c.json(
        { error: { message: "החשבון מושבת.", code: "ACCOUNT_DISABLED" } },
        403
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await createSessionToken(user.id, { platform, deviceName });

    console.log(JSON.stringify({
      event: "user_login",
      userId: user.id,
      email: user.email,
      platform,
      timestamp: new Date().toISOString(),
      ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    }));

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
          isEmailVerified: user.isEmailVerified,
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
    const session = await db.userSession.findUnique({ where: { token } }).catch(() => null);
    await db.userSession.deleteMany({ where: { token } }).catch(() => {});
    if (session) {
      console.log(JSON.stringify({
        event: "user_logout",
        userId: session.userId,
        timestamp: new Date().toISOString(),
        ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
      }));
    }
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
      { error: { message: "משתמש לא נמצא", code: "NOT_FOUND" } },
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
  authRateLimit,
  zValidator("json", forgotPasswordSchema),
  async (c) => {
    const { email } = c.req.valid("json");

    const normalizedEmail = email.toLowerCase();
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return c.json({
        data: {
          success: true,
          message: "אם האימייל קיים במערכת, נשלח קישור לאיפוס סיסמה",
        },
      });
    }

    // Delete any existing unused reset tokens for this user
    await db.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null, type: "password_reset" },
    });

    const resetToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + ONE_HOUR_MS);

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        type: "password_reset",
        expiresAt,
      },
    });

    // Send reset email (non-blocking)
    sendPasswordResetEmail(
      user.email,
      resetToken,
      user.username ?? user.email.split("@")[0] ?? user.email
    ).catch((err) => {
      console.error("[email] Failed to send password reset email:", err);
    });

    const responseData: {
      success: boolean;
      message: string;
      resetToken?: string;
    } = {
      success: true,
      message: "אם האימייל קיים במערכת, נשלח קישור לאיפוס סיסמה",
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
  resetRateLimit,
  zValidator("json", resetPasswordSchema),
  async (c) => {
    const { token, newPassword } = c.req.valid("json");

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.type !== "password_reset") {
      return c.json(
        { error: { message: "טוקן לא תקין או לא קיים", code: "INVALID_TOKEN" } },
        400
      );
    }

    if (resetToken.usedAt !== null) {
      return c.json(
        { error: { message: "הטוקן כבר שומש", code: "TOKEN_ALREADY_USED" } },
        400
      );
    }

    if (new Date() > resetToken.expiresAt) {
      return c.json(
        { error: { message: "הטוקן פג תוקף", code: "TOKEN_EXPIRED" } },
        400
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

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

    console.log(JSON.stringify({
      event: "password_reset",
      userId: resetToken.userId,
      timestamp: new Date().toISOString(),
      ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    }));

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
        { error: { message: "משתמש לא נמצא", code: "NOT_FOUND" } },
        404
      );
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatch) {
      return c.json(
        { error: { message: "הסיסמה הנוכחית שגויה", code: "INVALID_CREDENTIALS" } },
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

// ---------------------------------------------------------------------------
// PUT /api/auth/profile - Update profile
// ---------------------------------------------------------------------------

authRoutes.put(
  "/profile",
  authMiddleware,
  zValidator("json", updateProfileSchema),
  async (c) => {
    const userId = c.get("userId");
    const { username, email, displayName } = c.req.valid("json");

    if (email) {
      const existing = await db.user.findFirst({
        where: { email, id: { not: userId } },
      });
      if (existing) {
        return c.json(
          { error: { message: "כתובת האימייל כבר בשימוש", code: "EMAIL_TAKEN" } },
          409
        );
      }
    }

    if (username) {
      const existing = await db.user.findFirst({
        where: { username, id: { not: userId } },
      });
      if (existing) {
        return c.json(
          { error: { message: "שם המשתמש כבר תפוס", code: "USERNAME_TAKEN" } },
          409
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) {
      updateData.email = email;
      updateData.isEmailVerified = false; // re-verify on email change
    }
    // displayName is not a DB field yet; ignore silently or store in username
    // (schema has no displayName column — stored as-is if schema evolves)

    const user = await db.user.update({
      where: { id: userId },
      data: updateData,
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

    return c.json({ data: user });
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/auth/account - Real (hard) account deletion
// ---------------------------------------------------------------------------

authRoutes.delete(
  "/account",
  authMiddleware,
  zValidator("json", deleteAccountSchema),
  async (c) => {
    const userId = c.get("userId");
    const { password } = c.req.valid("json");

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return c.json(
        { error: { message: "משתמש לא נמצא", code: "NOT_FOUND" } },
        404
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return c.json(
        { error: { message: "הסיסמה שגויה", code: "INVALID_CREDENTIALS" } },
        401
      );
    }

    // Delete all related data in FK-safe order
    // BreakSessions are deleted via WorkSession cascade
    await db.workSession.deleteMany({ where: { userId } });
    await db.passwordResetToken.deleteMany({ where: { userId } });
    await db.userSession.deleteMany({ where: { userId } });
    await db.userSettings.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });

    console.log(JSON.stringify({
      event: "account_deleted",
      userId,
      email: user.email,
      timestamp: new Date().toISOString(),
    }));

    return new Response(null, { status: 204 });
  }
);

// ---------------------------------------------------------------------------
// POST /api/auth/request-account-deletion - Public endpoint (App Store compliance)
// ---------------------------------------------------------------------------

const requestAccountDeletionSchema = z.object({
  email: z.string().email("פורמט אימייל לא תקין"),
});

authRoutes.post(
  "/request-account-deletion",
  zValidator("json", requestAccountDeletionSchema),
  async (c) => {
    // Always return 200 — never expose whether email exists
    // This is a public endpoint required for App Store / Google Play compliance.
    // Actual deletion is performed from within the app (DELETE /api/auth/account).
    return c.json({
      data: {
        success: true,
        message:
          "כדי למחוק את חשבונך, פתח את האפליקציה, עבור להגדרות → חשבון → מחיקת חשבון.",
      },
    });
  }
);

// ---------------------------------------------------------------------------
// GET /api/auth/sessions - List active sessions
// ---------------------------------------------------------------------------

authRoutes.get("/sessions", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const currentToken = getCurrentToken(c.req.header("Authorization"));

  const sessions = await db.userSession.findMany({
    where: { userId, isActive: true, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
  });

  const data = sessions.map((session) => ({
    id: session.id,
    deviceName: session.deviceName,
    platform: session.platform,
    lastSeenAt: session.lastSeenAt,
    createdAt: session.createdAt,
    isCurrent: session.token === currentToken,
  }));

  return c.json({ data });
});

// ---------------------------------------------------------------------------
// DELETE /api/auth/sessions/:sessionId - Revoke a session
// ---------------------------------------------------------------------------

authRoutes.delete("/sessions/:sessionId", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("sessionId");
  const currentToken = getCurrentToken(c.req.header("Authorization"));

  const session = await db.userSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    return c.json(
      { error: { message: "סשן לא נמצא", code: "NOT_FOUND" } },
      404
    );
  }

  if (session.token === currentToken) {
    return c.json(
      { error: { message: "לא ניתן לבטל את הסשן הנוכחי", code: "CANNOT_REVOKE_CURRENT_SESSION" } },
      400
    );
  }

  await db.userSession.delete({ where: { id: sessionId } });

  return c.json({ data: { success: true } });
});

// ---------------------------------------------------------------------------
// POST /api/auth/send-verification - Send email verification
// ---------------------------------------------------------------------------

authRoutes.post("/send-verification", authMiddleware, async (c) => {
  const userId = c.get("userId");

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return c.json(
      { error: { message: "משתמש לא נמצא", code: "NOT_FOUND" } },
      404
    );
  }

  if (user.isEmailVerified) {
    return c.json(
      { error: { message: "האימייל כבר מאומת", code: "ALREADY_VERIFIED" } },
      400
    );
  }

  // Delete any existing unused verification tokens
  await db.passwordResetToken.deleteMany({
    where: { userId, usedAt: null, type: "email_verification" },
  });

  const verifyToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SIX_HOURS_MS);

  await db.passwordResetToken.create({
    data: {
      userId,
      token: verifyToken,
      type: "email_verification",
      expiresAt,
    },
  });

  sendEmailVerificationEmail(
    user.email,
    verifyToken,
    user.username ?? user.email.split("@")[0] ?? user.email
  ).catch((err) => {
    console.error("[email] Failed to send verification email:", err);
  });

  const responseData: { success: boolean; verifyToken?: string } = {
    success: true,
  };

  if (env.NODE_ENV !== "production") {
    responseData.verifyToken = verifyToken;
  }

  return c.json({ data: responseData });
});

// ---------------------------------------------------------------------------
// POST /api/auth/verify-email - Verify email with token
// ---------------------------------------------------------------------------

authRoutes.post(
  "/verify-email",
  zValidator("json", verifyEmailSchema),
  async (c) => {
    const { token } = c.req.valid("json");

    const record = await db.passwordResetToken.findUnique({ where: { token } });

    if (!record || record.type !== "email_verification") {
      return c.json(
        { error: { message: "טוקן לא תקין או לא קיים", code: "INVALID_TOKEN" } },
        400
      );
    }

    if (record.usedAt !== null) {
      return c.json(
        { error: { message: "הטוקן כבר שומש", code: "TOKEN_ALREADY_USED" } },
        400
      );
    }

    if (new Date() > record.expiresAt) {
      return c.json(
        { error: { message: "הטוקן פג תוקף", code: "TOKEN_EXPIRED" } },
        400
      );
    }

    await db.user.update({
      where: { id: record.userId },
      data: { isEmailVerified: true },
    });

    await db.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return c.json({ data: { success: true } });
  }
);

// ---------------------------------------------------------------------------
// GET /api/auth/user-settings - Get cloud settings
// ---------------------------------------------------------------------------

authRoutes.get("/user-settings", authMiddleware, async (c) => {
  const userId = c.get("userId");

  const settings = await db.userSettings.findUnique({ where: { userId } });

  if (!settings) {
    return c.json({ data: null });
  }

  return c.json({ data: settings });
});

// ---------------------------------------------------------------------------
// PUT /api/auth/user-settings - Save cloud settings
// ---------------------------------------------------------------------------

authRoutes.put(
  "/user-settings",
  authMiddleware,
  zValidator("json", userSettingsSchema),
  async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");

    const settings = await db.userSettings.upsert({
      where: { userId },
      create: { userId, ...body },
      update: body,
    });

    return c.json({ data: settings });
  }
);
