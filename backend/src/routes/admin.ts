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
];

adminPublicRoutes.post(
  "/setup",
  zValidator("json", setupSchema),
  async (c) => {
    // SETUP_SECRET gate
    if (env.SETUP_SECRET) {
      const providedSecret = c.req.header("x-setup-secret");
      if (providedSecret !== env.SETUP_SECRET) {
        return c.json(
          { error: { message: "Invalid or missing setup secret", code: "FORBIDDEN" } },
          403
        );
      }
    } else {
      logger.warn("SETUP_SECRET is not set. Setup endpoint is unprotected.");
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

    if (body.role && body.role !== existing.role) {
      console.log(JSON.stringify({
        event: "admin_role_change",
        targetUserId: id,
        targetEmail: user.email,
        oldRole: existing.role,
        newRole: body.role,
        timestamp: new Date().toISOString(),
        ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
      }));
    }

    const adminId = c.get("userId");
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

  return c.json({ data: { resetToken, expiresAt } });
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

