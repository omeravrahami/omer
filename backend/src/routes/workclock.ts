import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";

export const workclockRoutes = new Hono();

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createSessionSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),   // if provided → create completed session
  date: z.string().optional(),                 // YYYY-MM-DD override
  workplaceName: z.string().optional(),
  notes: z.string().optional(),
  sessionType: z.enum(["shift", "sick", "vacation"]).optional().default("shift"),
  breaks: z.array(z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
  })).optional(),
});

const updateSessionSchema = z.object({
  endTime: z.string().datetime().optional(),
  notes: z.string().optional(),
  workplaceName: z.string().optional(),
  status: z.enum(["active", "completed"]).optional(),
});

const editSessionSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  date: z.string().optional(),
  notes: z.string().optional(),
  sessionType: z.enum(["shift", "sick", "vacation"]).optional(),
  breaks: z.array(z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
  })).optional(),
});

const startBreakSchema = z.object({
  startTime: z.string().datetime().optional(),
});

const endBreakSchema = z.object({
  endTime: z.string().datetime().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function diffMinutes(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 60000;
}

async function calculateSessionTotals(sessionId: string, hourlyRate: number) {
  const session = await db.workSession.findUnique({
    where: { id: sessionId },
    include: { breaks: true },
  });
  if (!session || !session.endTime) return null;

  const grossMinutes = diffMinutes(new Date(session.startTime), new Date(session.endTime));
  const breakMinutes = session.breaks.reduce((sum, b) => sum + b.durationMinutes, 0);
  const netMinutes = Math.max(0, grossMinutes - breakMinutes);
  const totalPay = (netMinutes / 60) * hourlyRate;

  return { grossMinutes, breakMinutes, netMinutes, totalPay };
}

// ---------------------------------------------------------------------------
// AUTH-BASED ROUTES (new, uses authenticated userId)
// ---------------------------------------------------------------------------

const updateSettingsUserSchema = z.object({
  hourlyRate: z.number().min(0).optional(),
  currency: z.string().optional(),
  dailyGoalHours: z.number().min(0).optional(),
  weeklyGoalHours: z.number().min(0).optional(),
  defaultBreakMinutes: z.number().int().min(0).optional(),
  showSalaryOnDashboard: z.boolean().optional(),
  themeMode: z.string().optional(),
  onboardingCompleted: z.boolean().optional(),
});

// GET /api/user/settings — get settings for authenticated user
workclockRoutes.get("/api/user/settings", authMiddleware, async (c) => {
  const userId = c.get("userId");

  let settings = await db.userSettings.findUnique({ where: { userId } });
  if (!settings) {
    settings = await db.userSettings.create({ data: { userId } });
  }
  return c.json({ data: settings });
});

// PUT /api/user/settings — update settings for authenticated user
workclockRoutes.put(
  "/api/user/settings",
  authMiddleware,
  zValidator("json", updateSettingsUserSchema),
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

// GET /api/user/sessions — list sessions for authenticated user (?month=YYYY-MM&status=active|completed)
workclockRoutes.get("/api/user/sessions", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const month = c.req.query("month");
  const status = c.req.query("status");

  // Get user settings including premium status, and user role
  const [userSettings, userRecord] = await Promise.all([
    db.userSettings.findUnique({
      where: { userId },
      select: { isPremium: true, subscriptionStatus: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
  ]);

  const isPremium = userSettings?.isPremium ?? false;
  const isAdmin = userRecord?.role === 'ADMIN';
  const hasFullAccess = isPremium || isAdmin;

  // Retention enforcement for free users
  let cutoffDateStr: string | null = null;
  if (!hasFullAccess) {
    const retentionConfig = await db.appConfig.findUnique({
      where: { key: "retention_months_free" },
    });
    const retentionMonths = parseInt(retentionConfig?.value ?? "3", 10);
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
    cutoffDateStr = cutoffDate.toISOString().split("T")[0] ?? ""; // YYYY-MM-DD

    // If a specific month is requested and it's older than the cutoff, block it
    if (month && month < (cutoffDateStr as string).slice(0, 7)) {
      return c.json({ data: { sessions: [], isDataRestricted: true } });
    }
  }

  const where: Record<string, unknown> = { userId };

  // Apply month filter
  if (month) {
    where.date = { startsWith: month };
  } else if (cutoffDateStr) {
    // No specific month requested — limit to retention window
    where.date = { gte: cutoffDateStr };
  }

  if (status) {
    where.status = status;
  }

  const sessions = await db.workSession.findMany({
    where,
    include: { breaks: true },
    orderBy: { startTime: "desc" },
  });
  return c.json({ data: { sessions, isDataRestricted: !hasFullAccess } });
});

// GET /api/user/sessions/active — get active session for authenticated user
workclockRoutes.get("/api/user/sessions/active", authMiddleware, async (c) => {
  const userId = c.get("userId");

  const session = await db.workSession.findFirst({
    where: { userId, status: "active" },
    include: { breaks: true },
  });
  return c.json({ data: session });
});

// GET /api/user/sessions/months - returns distinct months with session data
workclockRoutes.get('/api/user/sessions/months', authMiddleware, async (c) => {
  const userId = c.get('userId');
  try {
    const sessions = await db.workSession.findMany({
      where: { userId },
      select: { date: true },
      orderBy: { date: 'desc' },
    });
    // Extract unique YYYY-MM keys
    const monthSet = new Set<string>();
    for (const s of sessions) {
      const m = s.date.slice(0, 7);
      monthSet.add(m);
    }
    // Always include current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthSet.add(currentMonth);
    const months = Array.from(monthSet).sort().reverse();
    return c.json({ data: { months } });
  } catch {
    return c.json({ error: { message: 'Failed to fetch months' } }, 500);
  }
});

// POST /api/user/sessions — create a new work session for authenticated user
workclockRoutes.post(
  "/api/user/sessions",
  authMiddleware,
  zValidator("json", createSessionSchema),
  async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");

    const startTime = body.startTime ? new Date(body.startTime) : new Date();
    const date = body.date ?? startTime.toISOString().slice(0, 10);
    const sessionType = body.sessionType ?? "shift";

    // Sick / Vacation days
    if (sessionType === "sick" || sessionType === "vacation") {
      const placeholderStart = new Date(`${date}T09:00:00.000Z`);
      const placeholderEnd   = new Date(`${date}T09:01:00.000Z`);

      const session = await db.workSession.create({
        data: {
          userId,
          date,
          startTime: placeholderStart,
          endTime: placeholderEnd,
          workplaceName: body.workplaceName ?? "",
          notes: body.notes ?? "",
          sessionType,
          grossMinutes: 0,
          breakMinutes: 0,
          netMinutes: 0,
          totalPay: 0,
          status: "completed",
        },
        include: { breaks: true },
      });
      return c.json({ data: session }, 201);
    }

    // Manual completed entry (endTime provided)
    if (body.endTime) {
      const endTime = new Date(body.endTime);
      if (endTime <= startTime) {
        return c.json(
          { error: { message: "שעת סיום חייבת להיות אחרי שעת התחלה", code: "INVALID_TIMES" } },
          400
        );
      }

      const session = await db.workSession.create({
        data: {
          userId,
          date,
          startTime,
          endTime,
          workplaceName: body.workplaceName ?? "",
          notes: body.notes ?? "",
          sessionType,
          status: "completed",
        },
      });

      if (body.breaks && body.breaks.length > 0) {
        for (const b of body.breaks) {
          const bs = new Date(b.startTime);
          const be = new Date(b.endTime);
          const dur = Math.max(0, (be.getTime() - bs.getTime()) / 60000);
          await db.breakSession.create({
            data: {
              workSessionId: session.id,
              startTime: bs,
              endTime: be,
              durationMinutes: dur,
            },
          });
        }
      }

      const userSettings = await db.userSettings.findUnique({ where: { userId } });
      const hourlyRate = userSettings?.hourlyRate ?? 50;
      const totals = await calculateSessionTotals(session.id, hourlyRate);
      if (totals) {
        await db.workSession.update({ where: { id: session.id }, data: totals });
      }

      const final = await db.workSession.findUnique({
        where: { id: session.id },
        include: { breaks: true },
      });
      return c.json({ data: final }, 201);
    }

    // Live session start
    const existing = await db.workSession.findFirst({
      where: { userId, status: "active" },
    });
    if (existing) {
      return c.json(
        { error: { message: "כבר קיימת משמרת פעילה. סיים אותה לפני שתתחיל חדשה", code: "ACTIVE_SESSION_EXISTS" } },
        400
      );
    }

    const session = await db.workSession.create({
      data: {
        userId,
        date,
        startTime,
        workplaceName: body.workplaceName ?? "",
        notes: body.notes ?? "",
        sessionType,
        status: "active",
      },
      include: { breaks: true },
    });
    return c.json({ data: session }, 201);
  }
);

// GET /api/user/sessions/:id — get single session for authenticated user
workclockRoutes.get("/api/user/sessions/:id", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.param();

  const session = await db.workSession.findFirst({
    where: { id, userId },
    include: { breaks: true },
  });
  if (!session) {
    return c.json({ error: { message: "משמרת לא נמצאה", code: "NOT_FOUND" } }, 404);
  }
  return c.json({ data: session });
});

// PUT /api/user/sessions/:id — update / end session for authenticated user
workclockRoutes.put(
  "/api/user/sessions/:id",
  authMiddleware,
  zValidator("json", updateSessionSchema),
  async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const session = await db.workSession.findFirst({ where: { id, userId } });
    if (!session) {
      return c.json({ error: { message: "משמרת לא נמצאה", code: "NOT_FOUND" } }, 404);
    }

    const updateData: Record<string, unknown> = {};
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.workplaceName !== undefined) updateData.workplaceName = body.workplaceName;

    if (body.endTime || body.status === "completed") {
      const endTime = body.endTime ? new Date(body.endTime) : new Date();
      updateData.endTime = endTime;
      updateData.status = "completed";

      const activeBreaks = await db.breakSession.findMany({
        where: { workSessionId: id, endTime: null },
      });
      for (const brk of activeBreaks) {
        const dur = diffMinutes(new Date(brk.startTime), endTime);
        await db.breakSession.update({
          where: { id: brk.id },
          data: { endTime, durationMinutes: Math.max(0, dur) },
        });
      }

      await db.workSession.update({ where: { id }, data: updateData });

      const userSettings = await db.userSettings.findUnique({ where: { userId } });
      const hourlyRate = userSettings?.hourlyRate ?? 50;
      const totals = await calculateSessionTotals(id, hourlyRate);
      if (totals) {
        await db.workSession.update({ where: { id }, data: totals });
      }

      const updated = await db.workSession.findUnique({
        where: { id },
        include: { breaks: true },
      });
      return c.json({ data: updated });
    }

    const updated = await db.workSession.update({
      where: { id },
      data: updateData,
      include: { breaks: true },
    });
    return c.json({ data: updated });
  }
);

// PATCH /api/user/sessions/:id/edit — fully replace a completed session for authenticated user
workclockRoutes.patch(
  "/api/user/sessions/:id/edit",
  authMiddleware,
  zValidator("json", editSessionSchema),
  async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.param();
    const body = c.req.valid("json");

    const session = await db.workSession.findFirst({ where: { id, userId } });
    if (!session) {
      return c.json({ error: { message: "משמרת לא נמצאה", code: "NOT_FOUND" } }, 404);
    }

    const startTime = new Date(body.startTime);
    const endTime = new Date(body.endTime);

    if (endTime <= startTime) {
      return c.json(
        { error: { message: "שעת סיום חייבת להיות אחרי שעת התחלה", code: "INVALID_TIMES" } },
        400
      );
    }

    const date = body.date ?? startTime.toISOString().slice(0, 10);

    await db.breakSession.deleteMany({ where: { workSessionId: id } });

    await db.workSession.update({
      where: { id },
      data: {
        startTime,
        endTime,
        date,
        notes: body.notes ?? session.notes,
        ...(body.sessionType !== undefined ? { sessionType: body.sessionType } : {}),
        status: "completed",
      },
    });

    if (body.breaks && body.breaks.length > 0) {
      for (const b of body.breaks) {
        const bs = new Date(b.startTime);
        const be = new Date(b.endTime);
        const dur = Math.max(0, (be.getTime() - bs.getTime()) / 60000);
        await db.breakSession.create({
          data: {
            workSessionId: id,
            startTime: bs,
            endTime: be,
            durationMinutes: dur,
          },
        });
      }
    }

    const userSettings = await db.userSettings.findUnique({ where: { userId } });
    const hourlyRate = userSettings?.hourlyRate ?? 50;
    const totals = await calculateSessionTotals(id, hourlyRate);
    if (totals) {
      await db.workSession.update({ where: { id }, data: totals });
    }

    const updated = await db.workSession.findUnique({
      where: { id },
      include: { breaks: true },
    });
    return c.json({ data: updated });
  }
);

// DELETE /api/user/sessions/:id — delete session for authenticated user
workclockRoutes.delete("/api/user/sessions/:id", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.param();

  const session = await db.workSession.findFirst({ where: { id, userId } });
  if (!session) {
    return c.json({ error: { message: "משמרת לא נמצאה", code: "NOT_FOUND" } }, 404);
  }

  await db.workSession.delete({ where: { id } });
  return c.json({ data: { success: true } });
});

// POST /api/user/sessions/:sessionId/breaks — start break (auth-based)
workclockRoutes.post(
  "/api/user/sessions/:sessionId/breaks",
  authMiddleware,
  zValidator("json", startBreakSchema),
  async (c) => {
    const userId = c.get("userId");
    const { sessionId } = c.req.param();
    const body = c.req.valid("json");

    const session = await db.workSession.findFirst({
      where: { id: sessionId, userId, status: "active" },
    });
    if (!session) {
      return c.json(
        { error: { message: "משמרת פעילה לא נמצאה", code: "SESSION_NOT_FOUND" } },
        404
      );
    }

    const activeBreak = await db.breakSession.findFirst({
      where: { workSessionId: sessionId, endTime: null },
    });
    if (activeBreak) {
      return c.json(
        { error: { message: "כבר קיימת הפסקה פעילה. סיים אותה לפני שתתחיל חדשה", code: "ACTIVE_BREAK_EXISTS" } },
        400
      );
    }

    const startTime = body.startTime ? new Date(body.startTime) : new Date();
    const brk = await db.breakSession.create({
      data: { workSessionId: sessionId, startTime },
    });
    return c.json({ data: brk }, 201);
  }
);

// PUT /api/user/sessions/:sessionId/breaks/:breakId — end break (auth-based)
workclockRoutes.put(
  "/api/user/sessions/:sessionId/breaks/:breakId",
  authMiddleware,
  zValidator("json", endBreakSchema),
  async (c) => {
    const userId = c.get("userId");
    const { sessionId, breakId } = c.req.param();
    const body = c.req.valid("json");

    const session = await db.workSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      return c.json(
        { error: { message: "משמרת לא נמצאה", code: "SESSION_NOT_FOUND" } },
        404
      );
    }

    const brk = await db.breakSession.findFirst({
      where: { id: breakId, workSessionId: sessionId },
    });
    if (!brk) {
      return c.json(
        { error: { message: "הפסקה לא נמצאה", code: "BREAK_NOT_FOUND" } },
        404
      );
    }
    if (brk.endTime) {
      return c.json(
        { error: { message: "ההפסקה כבר הסתיימה", code: "BREAK_ALREADY_ENDED" } },
        400
      );
    }

    const endTime = body.endTime ? new Date(body.endTime) : new Date();
    const durationMinutes = Math.max(0, diffMinutes(new Date(brk.startTime), endTime));

    const updated = await db.breakSession.update({
      where: { id: breakId },
      data: { endTime, durationMinutes },
    });
    return c.json({ data: updated });
  }
);

// GET /api/user/stats — get stats for authenticated user (?period=week|month|year&date=YYYY-MM-DD)
workclockRoutes.get("/api/user/stats", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const period = c.req.query("period") ?? "week";
  const dateStr = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const refDate = new Date(dateStr + "T00:00:00.000Z");

  let startDate: Date;
  let endDate: Date;

  if (period === "week") {
    const day = refDate.getUTCDay();
    const diffToSun = day;
    startDate = new Date(refDate);
    startDate.setUTCDate(refDate.getUTCDate() - diffToSun);
    endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 6);
  } else if (period === "month") {
    startDate = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), 1));
    endDate = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() + 1, 0));
  } else {
    startDate = new Date(Date.UTC(refDate.getUTCFullYear(), 0, 1));
    endDate = new Date(Date.UTC(refDate.getUTCFullYear(), 11, 31));
  }

  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  const sessions = await db.workSession.findMany({
    where: {
      userId,
      status: "completed",
      date: { gte: startStr, lte: endStr },
    },
    orderBy: { date: "asc" },
  });

  const shiftSessions = sessions.filter(s => !s.sessionType || s.sessionType === "shift");
  const totalHours = shiftSessions.reduce((sum, s) => sum + s.netMinutes / 60, 0);
  const totalPay = shiftSessions.reduce((sum, s) => sum + s.totalPay, 0);

  const uniqueDays = new Set(shiftSessions.map((s) => s.date));
  const workDaysCount = uniqueDays.size;
  const avgHoursPerDay = workDaysCount > 0 ? totalHours / workDaysCount : 0;

  const dailyMap = new Map<string, { hours: number; pay: number; sessions: number }>();
  for (const s of shiftSessions) {
    const entry = dailyMap.get(s.date) ?? { hours: 0, pay: 0, sessions: 0 };
    entry.hours += s.netMinutes / 60;
    entry.pay += s.totalPay;
    entry.sessions += 1;
    dailyMap.set(s.date, entry);
  }
  const dailyData = Array.from(dailyMap.entries()).map(([date, d]) => ({
    date,
    hours: Math.round(d.hours * 100) / 100,
    pay: Math.round(d.pay * 100) / 100,
    sessions: d.sessions,
  }));

  const userSettings = await db.userSettings.findUnique({ where: { userId } });
  const dailyGoalHours = userSettings?.dailyGoalHours ?? 8;
  const weeklyGoalHours = userSettings?.weeklyGoalHours ?? 40;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySessions = sessions.filter((s) => s.date === todayStr);
  const todayHours = todaySessions.reduce((sum, s) => sum + s.netMinutes / 60, 0);
  const dailyGoalProgress = dailyGoalHours > 0 ? Math.min(1, todayHours / dailyGoalHours) : 0;

  const now = new Date();
  const nowDay = now.getUTCDay();
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - nowDay);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndDate = new Date(weekStart);
  weekEndDate.setUTCDate(weekStart.getUTCDate() + 6);
  const weekEndStr = weekEndDate.toISOString().slice(0, 10);

  const weekSessions = await db.workSession.findMany({
    where: {
      userId,
      status: "completed",
      date: { gte: weekStartStr, lte: weekEndStr },
    },
  });
  const weekHours = weekSessions.reduce((sum, s) => sum + s.netMinutes / 60, 0);
  const weeklyGoalProgress = weeklyGoalHours > 0 ? Math.min(1, weekHours / weeklyGoalHours) : 0;

  return c.json({
    data: {
      totalHours: Math.round(totalHours * 100) / 100,
      totalPay: Math.round(totalPay * 100) / 100,
      avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
      workDaysCount,
      dailyData,
      dailyGoalProgress: Math.round(dailyGoalProgress * 100) / 100,
      weeklyGoalProgress: Math.round(weeklyGoalProgress * 100) / 100,
      period,
      startDate: startStr,
      endDate: endStr,
    },
  });
});

// GET /api/subscription/status — get current user's subscription status
workclockRoutes.get("/api/subscription/status", authMiddleware, async (c) => {
  const userId = c.get("userId");

  const [userSettings, userRecord] = await Promise.all([
    db.userSettings.findUnique({
      where: { userId },
      select: {
        isPremium: true,
        subscriptionStatus: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
        planType: true,
      },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
  ]);

  const isAdmin = userRecord?.role === 'ADMIN';
  const isPremium = isAdmin || (userSettings?.isPremium ?? false);

  return c.json({
    data: {
      isPremium,
      isAdmin,
      subscriptionStatus: isAdmin ? 'admin' : (userSettings?.subscriptionStatus ?? 'free'),
      subscriptionStartDate: userSettings?.subscriptionStartDate?.toISOString() ?? null,
      subscriptionEndDate: userSettings?.subscriptionEndDate?.toISOString() ?? null,
      planType: isAdmin ? 'admin' : (userSettings?.planType ?? 'free'),
    },
  });
});

// GET /api/subscription/config — public pricing configuration
workclockRoutes.get("/api/subscription/config", async (c) => {
  const configs = await db.appConfig.findMany({
    where: {
      key: {
        in: ['premium_price_monthly', 'premium_enabled', 'retention_months_free', 'ads_enabled'],
      },
    },
  });

  const configMap: Record<string, string> = {};
  for (const cfg of configs) {
    configMap[cfg.key] = cfg.value;
  }

  return c.json({
    data: {
      premium_price_monthly: configMap['premium_price_monthly'] ?? '9.99',
      premium_enabled: configMap['premium_enabled'] ?? 'true',
      retention_months_free: configMap['retention_months_free'] ?? '3',
      ads_enabled: configMap['ads_enabled'] ?? 'true',
    },
  });
});

