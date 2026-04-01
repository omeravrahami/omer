import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

import { db } from "../db";
import { adminMiddleware } from "../middleware/admin";
import { env } from "../env";
import { auditLog } from "../lib/audit";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Public admin router (no auth required) — setup only
// ---------------------------------------------------------------------------

export const adminPublicRoutes = new Hono();

const setupSchema = z.object({
  email: z.string().email("Invalid email format").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
});

const DEFAULT_CONFIGS = [
  { key: "tip_percentage", value: "12", description: "Default tip percentage" },
  { key: "min_wage", value: "32.30", description: "Israeli minimum wage per hour" },
  { key: "vat_rate", value: "18", description: "Israeli VAT percentage" },
  { key: "app_name", value: "WorkClock", description: "Application name" },
  { key: "support_email", value: "support@workclock.app", description: "Support email address" },
  { key: "premium_enabled", value: "true", description: "Enable premium subscription features" },
  { key: "retention_months_free", value: "3", description: "Months of history available to free users" },
  { key: "premium_price_monthly", value: "9.99", description: "Monthly premium subscription price" },
  { key: "ads_enabled", value: "true", description: "Enable ads for free users" },
];

adminPublicRoutes.post(
  "/setup",
  zValidator("json", setupSchema),
  async (c) => {
    // SETUP_SECRET gate
    if (!env.SETUP_SECRET) {
      if (env.NODE_ENV === "production") {
        return c.json(
          { error: { message: "Setup disabled in production", code: "FORBIDDEN" } },
          403
        );
      }
      logger.warn("SETUP_SECRET is not set. Setup endpoint is unprotected.");
    } else {
      const authorization = c.req.header("Authorization");
      const providedSecret =
        authorization && authorization.startsWith("Bearer ")
          ? authorization.slice(7).trim()
          : null;
      if (providedSecret !== env.SETUP_SECRET) {
        return c.json(
          { error: { message: "Invalid or missing setup secret", code: "UNAUTHORIZED" } },
          401
        );
      }
    }

    const existingAdmin = await db.user.findFirst({ where: { role: "ADMIN" } });

    // In production, block the route if any admin already exists
    if (existingAdmin && env.NODE_ENV === "production") {
      return c.json(
        { error: { message: "Admin already configured", code: "ADMIN_ALREADY_CONFIGURED" } },
        403
      );
    }

    if (existingAdmin) {
      return c.json(
        { error: { message: "An admin user already exists", code: "ADMIN_EXISTS" } },
        409
      );
    }

    const { email, password, username } = c.req.valid("json");

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
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    const token = crypto.randomUUID();
    await db.userSession.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
      },
    });

    for (const cfg of DEFAULT_CONFIGS) {
      await db.appConfig.upsert({
        where: { key: cfg.key },
        create: cfg,
        update: {},
      });
    }

    await auditLog({
      action: "ADMIN_SETUP",
      resource: "admin",
      details: { email },
      ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
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
// Protected admin router — requires ADMIN role
// ---------------------------------------------------------------------------

type AdminVariables = { userId: string };

export const adminRoutes = new Hono<{ Variables: AdminVariables }>();

adminRoutes.use("*", adminMiddleware);

// ---------------------------------------------------------------------------
// GET /api/admin/users
// ---------------------------------------------------------------------------

adminRoutes.get("/users", async (c) => {
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "20")));
  const search = c.req.query("search") ?? "";
  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { email: { contains: search } },
          { username: { contains: search } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        isEmailVerified: true,
        _count: {
          select: {
            sessions: {
              where: {
                isActive: true,
                expiresAt: { gt: new Date() },
              },
            },
          },
        },
      },
    }),
    db.user.count({ where }),
  ]);

  const usersWithSessionCount = users.map((u) => ({
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    isEmailVerified: u.isEmailVerified,
    sessionCount: u._count.sessions,
  }));

  return c.json({
    data: {
      users: usersWithSessionCount,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/users/:id
// ---------------------------------------------------------------------------

adminRoutes.get("/users/:id", async (c) => {
  const { id } = c.req.param();

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      isEmailVerified: true,
      settings: {
        select: {
          isPremium: true,
          subscriptionStatus: true,
          subscriptionStartDate: true,
          subscriptionEndDate: true,
          planType: true,
        },
      },
      sessions: {
        orderBy: { lastSeenAt: "desc" },
        take: 5,
        select: {
          id: true,
          deviceName: true,
          platform: true,
          lastSeenAt: true,
          createdAt: true,
          expiresAt: true,
          isActive: true,
        },
      },
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
// PUT /api/admin/users/:id
// ---------------------------------------------------------------------------

const updateUserSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

adminRoutes.put(
  "/users/:id",
  zValidator("json", updateUserSchema),
  async (c) => {
    const { id } = c.req.param();
    const body = c.req.valid("json");

    if (!body.status && !body.role) {
      return c.json(
        { error: { message: "No fields to update", code: "BAD_REQUEST" } },
        400
      );
    }

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return c.json(
        { error: { message: "User not found", code: "NOT_FOUND" } },
        404
      );
    }

    const updateData: { status?: string; role?: string } = {};
    if (body.status) updateData.status = body.status;
    if (body.role) updateData.role = body.role;

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        isEmailVerified: true,
      },
    });

    // Revoke all active sessions when suspending or disabling a user
    if (body.status === "SUSPENDED" || body.status === "DISABLED") {
      await db.userSession.deleteMany({ where: { userId: id } });
    }

    const adminId = c.get("userId");

    if (body.role && body.role !== existing.role) {
      await auditLog({
        userId: adminId,
        action: "ROLE_CHANGED",
        resource: "user",
        details: {
          targetUserId: id,
          targetEmail: user.email,
          oldRole: existing.role,
          newRole: body.role,
        },
        ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
      });
    }

    await auditLog({
      userId: adminId,
      action: "UPDATE_USER",
      resource: "user",
      details: { targetUserId: id, changes: updateData },
      ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({ data: user });
  }
);

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/reset-password
// ---------------------------------------------------------------------------

adminRoutes.post("/users/:id/reset-password", async (c) => {
  const { id } = c.req.param();

  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    return c.json(
      { error: { message: "User not found", code: "NOT_FOUND" } },
      404
    );
  }

  await db.passwordResetToken.deleteMany({
    where: { userId: id, usedAt: null },
  });

  const resetToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ONE_HOUR_MS);

  await db.passwordResetToken.create({
    data: {
      userId: id,
      token: resetToken,
      expiresAt,
    },
  });

  await auditLog({
    userId: c.get("userId"),
    action: "RESET_USER_PASSWORD",
    resource: "user",
    details: { targetUserId: id },
    ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
  });

  return c.json({ data: { success: true, message: "Password reset email sent", expiresAt } });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/:id/sessions
// ---------------------------------------------------------------------------

adminRoutes.delete("/users/:id/sessions", async (c) => {
  const { id } = c.req.param();

  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    return c.json(
      { error: { message: "User not found", code: "NOT_FOUND" } },
      404
    );
  }

  const result = await db.userSession.deleteMany({ where: { userId: id } });

  return c.json({ data: { success: true, deletedCount: result.count } });
});

// ---------------------------------------------------------------------------
// GET /api/admin/stats
// ---------------------------------------------------------------------------

adminRoutes.get("/stats", async (c) => {
  const now = new Date();

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    adminCount,
    totalSessions,
    recentUsers,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { status: "ACTIVE" } }),
    db.user.count({ where: { status: "SUSPENDED" } }),
    db.user.count({ where: { role: "ADMIN" } }),
    db.userSession.count(),
    db.user.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const dayMap = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(sevenDaysAgo.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, 0);
  }
  for (const u of recentUsers) {
    const key = u.createdAt.toISOString().slice(0, 10);
    dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
  }
  const recentRegistrations = Array.from(dayMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  return c.json({
    data: {
      totalUsers,
      activeUsers,
      suspendedUsers,
      adminCount,
      recentRegistrations,
      totalSessions,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/config
// ---------------------------------------------------------------------------

adminRoutes.get("/config", async (c) => {
  const configs = await db.appConfig.findMany({
    orderBy: { key: "asc" },
    select: {
      key: true,
      value: true,
      description: true,
      updatedAt: true,
    },
  });

  return c.json({ data: { configs } });
});

// ---------------------------------------------------------------------------
// PUT /api/admin/config/:key
// ---------------------------------------------------------------------------

const upsertConfigSchema = z.object({
  value: z.string().min(1, "Value is required"),
  description: z.string().optional(),
});

adminRoutes.put(
  "/config/:key",
  zValidator("json", upsertConfigSchema),
  async (c) => {
    const { key } = c.req.param();
    const { value, description } = c.req.valid("json");

    const config = await db.appConfig.upsert({
      where: { key },
      create: { key, value, description },
      update: { value, ...(description !== undefined ? { description } : {}) },
    });

    await auditLog({
      userId: c.get("userId"),
      action: "CONFIG_UPDATED",
      resource: "config",
      details: { key, value },
      ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({ data: config });
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/:id
// ---------------------------------------------------------------------------

adminRoutes.delete("/users/:id", async (c) => {
  const { id } = c.req.param();
  const adminId = c.get("userId");

  // Prevent self-deletion
  if (id === adminId) {
    return c.json({ error: { message: "Cannot delete your own account", code: "SELF_DELETE" } }, 400);
  }

  const user = await db.user.findUnique({ where: { id } });
  if (!user) {
    return c.json({ error: { message: "User not found", code: "NOT_FOUND" } }, 404);
  }

  // Hard delete - cascades via FK
  await db.workSession.deleteMany({ where: { userId: id } });
  await db.passwordResetToken.deleteMany({ where: { userId: id } });
  await db.userSession.deleteMany({ where: { userId: id } });
  await db.userSettings.deleteMany({ where: { userId: id } });
  await db.user.delete({ where: { id } });

  await auditLog({
    userId: adminId,
    action: "DELETE_USER",
    resource: "user",
    details: { targetUserId: id, targetEmail: user.email },
    ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
  });

  return new Response(null, { status: 204 });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:userId/subscription — manually set premium status
// ---------------------------------------------------------------------------

adminRoutes.patch(
  "/users/:userId/subscription",
  zValidator("json", z.object({
    isPremium: z.boolean(),
    subscriptionStatus: z.enum(["free", "active", "expired", "trial", "canceled"]).optional(),
    planType: z.enum(["free", "monthly", "yearly"]).optional(),
    subscriptionEndDate: z.string().datetime().optional().nullable(),
  })),
  async (c) => {
    const { userId } = c.req.param();
    const { isPremium, subscriptionStatus, planType, subscriptionEndDate } = c.req.valid("json");

    const updated = await db.userSettings.upsert({
      where: { userId },
      update: {
        isPremium,
        subscriptionStatus: subscriptionStatus ?? (isPremium ? "active" : "free"),
        planType: planType ?? (isPremium ? "monthly" : "free"),
        subscriptionStartDate: isPremium ? new Date() : null,
        subscriptionEndDate: subscriptionEndDate ? new Date(subscriptionEndDate) : null,
      },
      create: {
        userId,
        isPremium,
        subscriptionStatus: subscriptionStatus ?? (isPremium ? "active" : "free"),
        planType: planType ?? (isPremium ? "monthly" : "free"),
      },
    });

    return c.json({ data: updated });
  }
);

// ---------------------------------------------------------------------------
// GET /api/admin/subscriptions/stats — premium stats overview
// ---------------------------------------------------------------------------

adminRoutes.get("/subscriptions/stats", async (c) => {
  const [totalUsers, premiumUsers, freeUsers] = await Promise.all([
    db.user.count(),
    db.userSettings.count({ where: { isPremium: true } }),
    db.userSettings.count({ where: { isPremium: false } }),
  ]);

  const recentPremium = await db.userSettings.findMany({
    where: { isPremium: true },
    include: { user: { select: { email: true, username: true } } },
    orderBy: { subscriptionStartDate: "desc" },
    take: 10,
  });

  return c.json({
    data: {
      totalUsers,
      premiumUsers,
      freeUsers,
      conversionRate: totalUsers > 0 ? (premiumUsers / totalUsers * 100).toFixed(1) : "0",
      recentPremium: recentPremium.map(s => ({
        userId: s.userId,
        email: s.user.email,
        username: s.user.username,
        startDate: s.subscriptionStartDate,
        endDate: s.subscriptionEndDate,
        planType: s.planType,
      })),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/audit-logs
// ---------------------------------------------------------------------------

adminRoutes.get("/audit-logs", async (c) => {
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? "50")));
  const userId = c.req.query("userId") ?? undefined;
  const action = c.req.query("action") ?? undefined;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (action) where.action = action;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    db.auditLog.count({ where }),
  ]);

  return c.json({
    data: {
      logs,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/dashboard
// ---------------------------------------------------------------------------

adminRoutes.get("/dashboard", async (c) => {
  const now = new Date();

  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersToday,
    newUsersThisWeek,
    newUsersThisMonth,
    dauToday,
    wauThisWeek,
    totalWorkSessionsToday,
    totalWorkSessionsThisWeek,
    totalWorkSessionsAllTime,
    completedSessionsThisMonth,
    accountDeletionRequests,
    totalAuditLogs,
    adsEnabledConfig,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: todayMidnight } } }),
    db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.user.count({ where: { lastLoginAt: { gte: todayMidnight } } }),
    db.user.count({ where: { lastLoginAt: { gte: sevenDaysAgo } } }),
    db.workSession.count({ where: { createdAt: { gte: todayMidnight } } }),
    db.workSession.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.workSession.count(),
    db.workSession.findMany({
      where: {
        status: "completed",
        startTime: { gte: thirtyDaysAgo },
        endTime: { not: null },
      },
      select: { startTime: true, endTime: true },
    }),
    db.passwordResetToken.count({ where: { type: "ACCOUNT_DELETION" } }).catch(() => 0),
    db.auditLog.count(),
    db.appConfig.findUnique({ where: { key: "ads_enabled" } }),
  ]);

  const avgHoursPerActiveUser =
    completedSessionsThisMonth.length === 0
      ? 0
      : completedSessionsThisMonth.reduce((sum, s) => {
          return sum + (new Date(s.endTime!).getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60);
        }, 0) / completedSessionsThisMonth.length;

  const adsEnabled = adsEnabledConfig?.value === "true";

  return c.json({
    data: {
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      dauToday,
      wauThisWeek,
      totalWorkSessionsToday,
      totalWorkSessionsThisWeek,
      totalWorkSessionsAllTime,
      avgHoursPerActiveUser,
      accountDeletionRequests,
      totalAuditLogs,
      adsEnabled,
    },
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id/status
// ---------------------------------------------------------------------------

const patchUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]),
});

adminRoutes.patch(
  "/users/:id/status",
  zValidator("json", patchUserStatusSchema),
  async (c) => {
    const { id } = c.req.param();
    const { status } = c.req.valid("json");

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: { message: "User not found", code: "NOT_FOUND" } }, 404);
    }

    const user = await db.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        isEmailVerified: true,
      },
    });

    // Revoke all active sessions when suspending or disabling a user
    if (status === "SUSPENDED" || status === "DISABLED") {
      await db.userSession.deleteMany({ where: { userId: id } });
    }

    const action = status === "SUSPENDED" ? "USER_BLOCKED" : "USER_UNBLOCKED";
    await auditLog({
      userId: c.get("userId"),
      action,
      resource: "user",
      details: { targetUserId: id, status },
      ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({ data: user });
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id/role
// ---------------------------------------------------------------------------

const patchUserRoleSchema = z.object({
  role: z.enum(["USER", "ADMIN"]),
});

adminRoutes.patch(
  "/users/:id/role",
  zValidator("json", patchUserRoleSchema),
  async (c) => {
    const { id } = c.req.param();
    const { role } = c.req.valid("json");
    const adminId = c.get("userId");

    if (adminId === id) {
      return c.json({ error: { message: "Cannot change your own role", code: "SELF_ROLE_CHANGE" } }, 400);
    }

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: { message: "User not found", code: "NOT_FOUND" } }, 404);
    }

    const user = await db.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        isEmailVerified: true,
      },
    });

    await auditLog({
      userId: adminId,
      action: "ROLE_CHANGED",
      resource: "user",
      details: { targetUserId: id, oldRole: existing.role, newRole: role },
      ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    return c.json({ data: user });
  }
);

// ---------------------------------------------------------------------------
// GET /api/admin/usage-analytics
// ---------------------------------------------------------------------------

adminRoutes.get("/usage-analytics", async (c) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [
    recentSessions,
    last14DaysSessions,
    totalWorkSessions,
    totalBreakSessions,
    totalUsers,
    completedSessionsCount,
    manualSessionsCount,
  ] = await Promise.all([
    db.workSession.findMany({
      where: { startTime: { gte: thirtyDaysAgo } },
      select: { userId: true, startTime: true },
    }),
    db.workSession.findMany({
      where: { startTime: { gte: fourteenDaysAgo } },
      select: { startTime: true },
    }),
    db.workSession.count(),
    db.breakSession.count(),
    db.user.count(),
    db.workSession.count({ where: { status: "completed" } }),
    db.workSession.count({
      where: {
        OR: [
          { sessionType: { not: "shift" } },
          { notes: { not: "" } },
        ],
      },
    }),
  ]);

  // Aggregate dailyActiveUsers: group by date, count unique userIds
  const dauByDate = new Map<string, Set<string>>();
  for (const s of recentSessions) {
    const date = s.startTime.toISOString().slice(0, 10);
    if (!dauByDate.has(date)) dauByDate.set(date, new Set());
    dauByDate.get(date)!.add(s.userId);
  }
  const dailyActiveUsers = Array.from(dauByDate.entries())
    .map(([date, users]) => ({ date, count: users.size }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Aggregate sessionsPerDay for last 14 days
  const spdByDate = new Map<string, number>();
  for (const s of last14DaysSessions) {
    const date = s.startTime.toISOString().slice(0, 10);
    spdByDate.set(date, (spdByDate.get(date) ?? 0) + 1);
  }
  const sessionsPerDay = Array.from(spdByDate.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const avgSessionsPerUser = totalWorkSessions / Math.max(totalUsers, 1);

  return c.json({
    data: {
      dailyActiveUsers,
      sessionsPerDay,
      totalWorkSessions,
      totalBreakSessions,
      avgSessionsPerUser,
      completedSessions: completedSessionsCount,
      manualSessions: manualSessionsCount,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/salary-analytics
// ---------------------------------------------------------------------------

adminRoutes.get("/salary-analytics", async (c) => {
  const [
    totalUsersWithSalaryConfigured,
    allUserSettings,
    totalCompletedSessions,
    completedSessionsForAvg,
  ] = await Promise.all([
    db.userSettings.count({ where: { hourlyRate: { gt: 0 } } }),
    db.userSettings.findMany({
      where: { hourlyRate: { gt: 0 } },
      select: { hourlyRate: true },
    }),
    db.workSession.count({ where: { status: "completed" } }),
    db.workSession.findMany({
      where: { status: "completed", endTime: { not: null } },
      select: { startTime: true, endTime: true },
      take: 1000,
    }),
  ]);

  const avgHourlyRate =
    allUserSettings.length === 0
      ? 0
      : allUserSettings.reduce((sum, s) => sum + s.hourlyRate, 0) / allUserSettings.length;

  const avgSessionDurationMinutes =
    completedSessionsForAvg.length === 0
      ? 0
      : completedSessionsForAvg.reduce(
          (sum, s) =>
            sum +
            (new Date(s.endTime!).getTime() - new Date(s.startTime).getTime()) / 60000,
          0
        ) / completedSessionsForAvg.length;

  return c.json({
    data: {
      totalUsersWithSalaryConfigured,
      avgHourlyRate,
      totalCompletedSessions,
      avgSessionDurationMinutes,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/ads
// ---------------------------------------------------------------------------

const ADS_DEFAULTS: Record<string, string> = {
  ads_enabled: "false",
  ads_test_mode: "true",
  banner_enabled: "false",
  interstitial_enabled: "false",
  rewarded_enabled: "false",
  banner_unit_id: "",
  interstitial_unit_id: "",
  rewarded_unit_id: "",
};

async function getAdsConfig() {
  const keys = Object.keys(ADS_DEFAULTS);
  const configs = await db.appConfig.findMany({ where: { key: { in: keys } } });
  const map = new Map(configs.map((c) => [c.key, c.value]));

  return {
    adsEnabled: (map.get("ads_enabled") ?? ADS_DEFAULTS.ads_enabled) === "true",
    testMode: (map.get("ads_test_mode") ?? ADS_DEFAULTS.ads_test_mode) === "true",
    bannerEnabled: (map.get("banner_enabled") ?? ADS_DEFAULTS.banner_enabled) === "true",
    interstitialEnabled: (map.get("interstitial_enabled") ?? ADS_DEFAULTS.interstitial_enabled) === "true",
    rewardedEnabled: (map.get("rewarded_enabled") ?? ADS_DEFAULTS.rewarded_enabled) === "true",
    bannerUnitId: map.get("banner_unit_id") ?? ADS_DEFAULTS.banner_unit_id,
    interstitialUnitId: map.get("interstitial_unit_id") ?? ADS_DEFAULTS.interstitial_unit_id,
    rewardedUnitId: map.get("rewarded_unit_id") ?? ADS_DEFAULTS.rewarded_unit_id,
  };
}

adminRoutes.get("/ads", async (c) => {
  const config = await getAdsConfig();
  return c.json({ data: config });
});

// ---------------------------------------------------------------------------
// PUT /api/admin/ads
// ---------------------------------------------------------------------------

const putAdsSchema = z.object({
  adsEnabled: z.boolean().optional(),
  testMode: z.boolean().optional(),
  bannerEnabled: z.boolean().optional(),
  interstitialEnabled: z.boolean().optional(),
  rewardedEnabled: z.boolean().optional(),
  bannerUnitId: z.string().optional(),
  interstitialUnitId: z.string().optional(),
  rewardedUnitId: z.string().optional(),
});

adminRoutes.put(
  "/ads",
  zValidator("json", putAdsSchema),
  async (c) => {
    const body = c.req.valid("json");

    const keyMap: Array<[keyof typeof body, string]> = [
      ["adsEnabled", "ads_enabled"],
      ["testMode", "ads_test_mode"],
      ["bannerEnabled", "banner_enabled"],
      ["interstitialEnabled", "interstitial_enabled"],
      ["rewardedEnabled", "rewarded_enabled"],
      ["bannerUnitId", "banner_unit_id"],
      ["interstitialUnitId", "interstitial_unit_id"],
      ["rewardedUnitId", "rewarded_unit_id"],
    ];

    for (const [field, key] of keyMap) {
      const val = body[field];
      if (val === undefined) continue;
      const value = typeof val === "boolean" ? (val ? "true" : "false") : String(val);
      await db.appConfig.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }

    await auditLog({
      userId: c.get("userId"),
      action: "ADS_CONFIG_UPDATED",
      resource: "config",
      details: body as object,
      ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    });

    const config = await getAdsConfig();
    return c.json({ data: config });
  }
);

// ---------------------------------------------------------------------------
// GET /api/admin/system-stats
// ---------------------------------------------------------------------------

adminRoutes.get("/system-stats", async (c) => {
  const [
    databaseConnected,
    totalAuditLogs,
    totalUserSessions,
    totalUsers,
    totalWorkSessions,
  ] = await Promise.all([
    db.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    db.auditLog.count(),
    db.userSession.count(),
    db.user.count(),
    db.workSession.count(),
  ]);

  return c.json({
    data: {
      environment: env.NODE_ENV,
      databaseConnected,
      totalAuditLogs,
      totalUserSessions,
      totalUsers,
      totalWorkSessions,
      uptime: process.uptime(),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/errors
// ---------------------------------------------------------------------------

adminRoutes.get("/errors", async (c) => {
  const where = {
    OR: [
      { action: { startsWith: "ERROR" } },
      { action: { startsWith: "FAIL" } },
    ],
  };

  const [errorLogs, totalErrors] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.auditLog.count({ where }),
  ]);

  return c.json({ data: { logs: errorLogs, totalErrors } });
});
