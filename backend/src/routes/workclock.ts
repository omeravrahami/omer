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

  const where: Record<string, unknown> = { userId };
  if (month) {
    where.date = { startsWith: month };
  }
  if (status) {
    where.status = status;
  }

  const sessions = await db.workSession.findMany({
    where,
    include: { breaks: true },
    orderBy: { startTime: "desc" },
  });
  return c.json({ data: sessions });
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

// POST /api/user/sessions — create a new work session for authenticated user
workclockRoutes.post(
  "/api/user/sessions",
  authMiddleware,
  zValidator("json", createSessionSchema),
  async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const deviceId = (body as { deviceId?: string }).deviceId ?? "";

    const startTime = body.startTime ? new Date(body.startTime) : new Date();
    const date = body.date ?? startTime.toISOString().slice(0, 10);
    const sessionType = body.sessionType ?? "shift";

    // Sick / Vacation days
    if (sessionType === "sick" || sessionType === "vacation") {
      const placeholderStart = new Date(`${date}T09:00:00.000Z`);
      const placeholderEnd   = new Date(`${date}T09:01:00.000Z`);

      const session = await db.workSession.create({
        data: {
          deviceId,
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
          deviceId,
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
        deviceId,
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

// ---------------------------------------------------------------------------
// GUEST / DEVICE-BASED ROUTES — no auth required, keyed by deviceId
// ---------------------------------------------------------------------------

const updateSettingsDeviceSchema = z.object({
  hourlyRate: z.number().min(0).optional(),
  currency: z.string().optional(),
  dailyGoalHours: z.number().min(0).optional(),
  weeklyGoalHours: z.number().min(0).optional(),
  defaultBreakMinutes: z.number().int().min(0).optional(),
  showSalaryOnDashboard: z.boolean().optional(),
  themeMode: z.string().optional(),
  isPro: z.boolean().optional(),
  onboardingCompleted: z.boolean().optional(),
});

// GET /api/settings/:deviceId
workclockRoutes.get("/api/settings/:deviceId", async (c) => {
  const { deviceId } = c.req.param();
  let settings = await db.settings.findUnique({ where: { deviceId } });
  if (!settings) {
    settings = await db.settings.create({ data: { deviceId } });
  }
  return c.json({ data: settings });
});

// PUT /api/settings/:deviceId
workclockRoutes.put("/api/settings/:deviceId", zValidator("json", updateSettingsDeviceSchema), async (c) => {
  const { deviceId } = c.req.param();
  const body = c.req.valid("json");
  const settings = await db.settings.upsert({
    where: { deviceId },
    create: { deviceId, ...body },
    update: body,
  });
  return c.json({ data: settings });
});

// GET /api/sessions/:deviceId
workclockRoutes.get("/api/sessions/:deviceId", async (c) => {
  const { deviceId } = c.req.param();
  const month = c.req.query("month");
  const status = c.req.query("status");
  const where: Record<string, unknown> = { deviceId };
  if (month) where.date = { startsWith: month };
  if (status) where.status = status;
  const sessions = await db.workSession.findMany({
    where,
    include: { breaks: true },
    orderBy: { startTime: "desc" },
  });
  return c.json({ data: sessions });
});

// GET /api/sessions/:deviceId/active
workclockRoutes.get("/api/sessions/:deviceId/active", async (c) => {
  const { deviceId } = c.req.param();
  const session = await db.workSession.findFirst({
    where: { deviceId, status: "active" },
    include: { breaks: true },
  });
  return c.json({ data: session });
});

// GET /api/sessions/:deviceId/:id
workclockRoutes.get("/api/sessions/:deviceId/:id", async (c) => {
  const { deviceId, id } = c.req.param();
  const session = await db.workSession.findFirst({
    where: { id, deviceId },
    include: { breaks: true },
  });
  if (!session) return c.json({ error: { message: "Not found", code: "NOT_FOUND" } }, 404);
  return c.json({ data: session });
});

// POST /api/sessions/:deviceId — start or create completed session
workclockRoutes.post("/api/sessions/:deviceId", zValidator("json", createSessionSchema), async (c) => {
  const { deviceId } = c.req.param();
  const body = c.req.valid("json");

  const startTime = body.startTime ? new Date(body.startTime) : new Date();
  const date = body.date ?? startTime.toISOString().slice(0, 10);
  const sessionType = body.sessionType ?? "shift";

  if (sessionType === "sick" || sessionType === "vacation") {
    const placeholderStart = new Date(`${date}T09:00:00.000Z`);
    const placeholderEnd = new Date(`${date}T09:00:00.000Z`);
    const session = await db.workSession.create({
      data: { deviceId, date, startTime: placeholderStart, endTime: placeholderEnd, status: "completed", sessionType, grossMinutes: 0, breakMinutes: 0, netMinutes: 0, totalPay: 0, notes: body.notes ?? "", workplaceName: body.workplaceName ?? "" },
      include: { breaks: true },
    });
    return c.json({ data: session });
  }

  if (body.endTime) {
    const endTime = new Date(body.endTime);
    const settings = await db.settings.findUnique({ where: { deviceId } });
    const hourlyRate = settings?.hourlyRate ?? 50;
    let breakMinutes = 0;
    const breaksData: { startTime: Date; endTime: Date; durationMinutes: number }[] = [];
    if (body.breaks) {
      for (const b of body.breaks) {
        const dur = diffMinutes(new Date(b.startTime), new Date(b.endTime));
        breakMinutes += dur;
        breaksData.push({ startTime: new Date(b.startTime), endTime: new Date(b.endTime), durationMinutes: dur });
      }
    }
    const grossMinutes = diffMinutes(startTime, endTime);
    const netMinutes = Math.max(0, grossMinutes - breakMinutes);
    const totalPay = (netMinutes / 60) * hourlyRate;
    const session = await db.workSession.create({
      data: { deviceId, date, startTime, endTime, status: "completed", sessionType, grossMinutes, breakMinutes, netMinutes, totalPay, notes: body.notes ?? "", workplaceName: body.workplaceName ?? "", breaks: { create: breaksData } },
      include: { breaks: true },
    });
    return c.json({ data: session });
  }

  const existing = await db.workSession.findFirst({ where: { deviceId, status: "active" } });
  if (existing) return c.json({ error: { message: "Active session exists", code: "ACTIVE_SESSION_EXISTS" } }, 409);

  const session = await db.workSession.create({
    data: { deviceId, date, startTime, status: "active", sessionType, notes: body.notes ?? "", workplaceName: body.workplaceName ?? "" },
    include: { breaks: true },
  });
  return c.json({ data: session });
});

// PUT /api/sessions/:deviceId/:id
workclockRoutes.put("/api/sessions/:deviceId/:id", zValidator("json", updateSessionSchema), async (c) => {
  const { deviceId, id } = c.req.param();
  const body = c.req.valid("json");
  const session = await db.workSession.findFirst({ where: { id, deviceId } });
  if (!session) return c.json({ error: { message: "Not found", code: "NOT_FOUND" } }, 404);

  if (body.status === "completed" && body.endTime) {
    const settings = await db.settings.findUnique({ where: { deviceId } });
    const hourlyRate = settings?.hourlyRate ?? 50;
    const endTime = new Date(body.endTime);
    const updatedSession = await db.workSession.update({ where: { id }, data: { endTime, status: "completed", notes: body.notes, workplaceName: body.workplaceName }, include: { breaks: true } });
    const totals = await calculateSessionTotals(id, hourlyRate);
    if (totals) await db.workSession.update({ where: { id }, data: totals });
    return c.json({ data: { ...updatedSession, ...totals } });
  }

  const updated = await db.workSession.update({ where: { id }, data: { notes: body.notes, workplaceName: body.workplaceName }, include: { breaks: true } });
  return c.json({ data: updated });
});

// PATCH /api/sessions/:deviceId/:id/edit
workclockRoutes.patch("/api/sessions/:deviceId/:id/edit", zValidator("json", editSessionSchema), async (c) => {
  const { deviceId, id } = c.req.param();
  const body = c.req.valid("json");
  const session = await db.workSession.findFirst({ where: { id, deviceId } });
  if (!session) return c.json({ error: { message: "Not found", code: "NOT_FOUND" } }, 404);
  const settings = await db.settings.findUnique({ where: { deviceId } });
  const hourlyRate = settings?.hourlyRate ?? 50;
  await db.breakSession.deleteMany({ where: { workSessionId: id } });
  const startTime = new Date(body.startTime);
  const endTime = new Date(body.endTime);
  let breakMinutes = 0;
  if (body.breaks) {
    for (const b of body.breaks) {
      const dur = diffMinutes(new Date(b.startTime), new Date(b.endTime));
      breakMinutes += dur;
      await db.breakSession.create({ data: { workSessionId: id, startTime: new Date(b.startTime), endTime: new Date(b.endTime), durationMinutes: dur } });
    }
  }
  const grossMinutes = diffMinutes(startTime, endTime);
  const netMinutes = Math.max(0, grossMinutes - breakMinutes);
  const totalPay = (netMinutes / 60) * hourlyRate;
  const updated = await db.workSession.update({ where: { id }, data: { startTime, endTime, date: body.date ?? startTime.toISOString().slice(0, 10), sessionType: body.sessionType, notes: body.notes, grossMinutes, breakMinutes, netMinutes, totalPay, status: "completed" }, include: { breaks: true } });
  return c.json({ data: updated });
});

// DELETE /api/sessions/:deviceId/:id
workclockRoutes.delete("/api/sessions/:deviceId/:id", async (c) => {
  const { deviceId, id } = c.req.param();
  const session = await db.workSession.findFirst({ where: { id, deviceId } });
  if (!session) return c.json({ error: { message: "Not found", code: "NOT_FOUND" } }, 404);
  await db.workSession.delete({ where: { id } });
  return new Response(null, { status: 204 });
});

// POST /api/sessions/:deviceId/:sessionId/breaks
workclockRoutes.post("/api/sessions/:deviceId/:sessionId/breaks", async (c) => {
  const { deviceId, sessionId } = c.req.param();
  const session = await db.workSession.findFirst({ where: { id: sessionId, deviceId, status: "active" } });
  if (!session) return c.json({ error: { message: "Active session not found", code: "NOT_FOUND" } }, 404);
  const existing = await db.breakSession.findFirst({ where: { workSessionId: sessionId, endTime: null } });
  if (existing) return c.json({ error: { message: "Break already active", code: "BREAK_ACTIVE" } }, 409);
  await db.breakSession.create({ data: { workSessionId: sessionId, startTime: new Date() } });
  const updated = await db.workSession.findUnique({ where: { id: sessionId }, include: { breaks: true } });
  return c.json({ data: updated });
});

// PUT /api/sessions/:deviceId/:sessionId/breaks/:breakId
workclockRoutes.put("/api/sessions/:deviceId/:sessionId/breaks/:breakId", async (c) => {
  const { deviceId, sessionId, breakId } = c.req.param();
  const session = await db.workSession.findFirst({ where: { id: sessionId, deviceId } });
  if (!session) return c.json({ error: { message: "Session not found", code: "NOT_FOUND" } }, 404);
  const endTime = new Date();
  const breakSession = await db.breakSession.findUnique({ where: { id: breakId } });
  if (!breakSession) return c.json({ error: { message: "Break not found", code: "NOT_FOUND" } }, 404);
  const durationMinutes = diffMinutes(new Date(breakSession.startTime), endTime);
  await db.breakSession.update({ where: { id: breakId }, data: { endTime, durationMinutes } });
  const updated = await db.workSession.findUnique({ where: { id: sessionId }, include: { breaks: true } });
  return c.json({ data: updated });
});

// GET /api/stats/:deviceId
workclockRoutes.get("/api/stats/:deviceId", async (c) => {
  const { deviceId } = c.req.param();
  const period = (c.req.query("period") as "week" | "month" | "year") ?? "month";
  const dateParam = c.req.query("date");
  const refDate = dateParam ? new Date(dateParam) : new Date();

  let startStr: string, endStr: string;
  if (period === "week") {
    const day = refDate.getUTCDay();
    const start = new Date(refDate); start.setUTCDate(refDate.getUTCDate() - day);
    const end = new Date(start); end.setUTCDate(start.getUTCDate() + 6);
    startStr = start.toISOString().slice(0, 10);
    endStr = end.toISOString().slice(0, 10);
  } else if (period === "year") {
    startStr = `${refDate.getUTCFullYear()}-01-01`;
    endStr = `${refDate.getUTCFullYear()}-12-31`;
  } else {
    const y = refDate.getUTCFullYear(), m = refDate.getUTCMonth() + 1;
    startStr = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    endStr = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }

  const sessions = await db.workSession.findMany({ where: { deviceId, status: "completed", date: { gte: startStr, lte: endStr } } });
  const totalHours = sessions.reduce((s, x) => s + x.netMinutes / 60, 0);
  const totalPay = sessions.reduce((s, x) => s + x.totalPay, 0);
  const workDaysCount = new Set(sessions.map((s) => s.date)).size;
  const avgHoursPerDay = workDaysCount > 0 ? totalHours / workDaysCount : 0;

  const dailyMap = new Map<string, { hours: number; pay: number; sessions: number }>();
  for (const s of sessions) {
    const entry = dailyMap.get(s.date) ?? { hours: 0, pay: 0, sessions: 0 };
    entry.hours += s.netMinutes / 60; entry.pay += s.totalPay; entry.sessions += 1;
    dailyMap.set(s.date, entry);
  }
  const dailyData = Array.from(dailyMap.entries()).map(([date, d]) => ({ date, hours: Math.round(d.hours * 100) / 100, pay: Math.round(d.pay * 100) / 100, sessions: d.sessions }));

  const settings = await db.settings.findUnique({ where: { deviceId } });
  const dailyGoalHours = settings?.dailyGoalHours ?? 8;
  const weeklyGoalHours = settings?.weeklyGoalHours ?? 40;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayHours = sessions.filter((s) => s.date === todayStr).reduce((sum, s) => sum + s.netMinutes / 60, 0);
  const dailyGoalProgress = dailyGoalHours > 0 ? Math.min(1, todayHours / dailyGoalHours) : 0;

  return c.json({ data: { totalHours: Math.round(totalHours * 100) / 100, totalPay: Math.round(totalPay * 100) / 100, avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100, workDaysCount, dailyData, dailyGoalProgress: Math.round(dailyGoalProgress * 100) / 100, weeklyGoalProgress: 0, period, startDate: startStr, endDate: endStr } });
});
