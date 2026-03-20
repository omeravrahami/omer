import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db";

export const workclockRoutes = new Hono();

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const updateSettingsSchema = z.object({
  hourlyRate: z.number().min(0).optional(),
  currency: z.string().optional(),
  dailyGoalHours: z.number().min(0).optional(),
  weeklyGoalHours: z.number().min(0).optional(),
  defaultBreakMinutes: z.number().int().min(0).optional(),
  showSalaryOnDashboard: z.boolean().optional(),
  themeMode: z.enum(["light", "dark"]).optional(),
  isPro: z.boolean().optional(),
  onboardingCompleted: z.boolean().optional(),
});

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
// Settings
// ---------------------------------------------------------------------------

// GET /api/settings/:deviceId — get or create default settings
workclockRoutes.get("/api/settings/:deviceId", async (c) => {
  const { deviceId } = c.req.param();

  let settings = await db.settings.findUnique({ where: { deviceId } });
  if (!settings) {
    settings = await db.settings.create({ data: { deviceId } });
  }
  return c.json({ data: settings });
});

// PUT /api/settings/:deviceId — update settings
workclockRoutes.put(
  "/api/settings/:deviceId",
  zValidator("json", updateSettingsSchema),
  async (c) => {
    const { deviceId } = c.req.param();
    const body = c.req.valid("json");

    // Ensure settings exist first
    let settings = await db.settings.findUnique({ where: { deviceId } });
    if (!settings) {
      settings = await db.settings.create({ data: { deviceId } });
    }

    const updated = await db.settings.update({
      where: { deviceId },
      data: body,
    });
    return c.json({ data: updated });
  }
);

// ---------------------------------------------------------------------------
// Work Sessions
// ---------------------------------------------------------------------------

// GET /api/sessions/:deviceId — list sessions (optional: ?month=YYYY-MM&status=active|completed)
workclockRoutes.get("/api/sessions/:deviceId", async (c) => {
  const { deviceId } = c.req.param();
  const month = c.req.query("month"); // YYYY-MM
  const status = c.req.query("status");

  const where: Record<string, unknown> = { deviceId };
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

// GET /api/sessions/:deviceId/active — get active session
workclockRoutes.get("/api/sessions/:deviceId/active", async (c) => {
  const { deviceId } = c.req.param();

  const session = await db.workSession.findFirst({
    where: { deviceId, status: "active" },
    include: { breaks: true },
  });
  return c.json({ data: session });
});

// GET /api/sessions/:deviceId/:id — get single session with breaks
workclockRoutes.get("/api/sessions/:deviceId/:id", async (c) => {
  const { deviceId, id } = c.req.param();

  const session = await db.workSession.findFirst({
    where: { id, deviceId },
    include: { breaks: true },
  });
  if (!session) {
    return c.json({ error: { message: "משמרת לא נמצאה", code: "NOT_FOUND" } }, 404);
  }
  return c.json({ data: session });
});

// POST /api/sessions/:deviceId — start a new work session (or create a completed manual entry)
workclockRoutes.post(
  "/api/sessions/:deviceId",
  zValidator("json", createSessionSchema),
  async (c) => {
    const { deviceId } = c.req.param();
    const body = c.req.valid("json");

    const startTime = body.startTime ? new Date(body.startTime) : new Date();
    const date = body.date ?? startTime.toISOString().slice(0, 10);
    const sessionType = body.sessionType ?? "shift";

    // ── Sick / Vacation days (no real times needed) ───────────────────────
    if (sessionType === "sick" || sessionType === "vacation") {
      // Use date at 09:00 / 09:01 as placeholder times
      const placeholderStart = new Date(`${date}T09:00:00.000Z`);
      const placeholderEnd   = new Date(`${date}T09:01:00.000Z`);

      const session = await db.workSession.create({
        data: {
          deviceId,
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

    // ── Manual completed entry (endTime provided) ──────────────────────────
    if (body.endTime) {
      const endTime = new Date(body.endTime);
      if (endTime <= startTime) {
        return c.json(
          { error: { message: "שעת סיום חייבת להיות אחרי שעת התחלה", code: "INVALID_TIMES" } },
          400
        );
      }

      // Create session as completed immediately
      const session = await db.workSession.create({
        data: {
          deviceId,
          date,
          startTime,
          endTime,
          workplaceName: body.workplaceName ?? "",
          notes: body.notes ?? "",
          sessionType,
          status: "completed",
        },
      });

      // Create breaks if provided
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

      // Calculate and persist totals
      const settings = await db.settings.findUnique({ where: { deviceId } });
      const hourlyRate = settings?.hourlyRate ?? 50;
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

    // ── Live session start (no endTime) ────────────────────────────────────
    // Prevent two active sessions
    const existing = await db.workSession.findFirst({
      where: { deviceId, status: "active" },
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

// PUT /api/sessions/:deviceId/:id — update / end session
workclockRoutes.put(
  "/api/sessions/:deviceId/:id",
  zValidator("json", updateSessionSchema),
  async (c) => {
    const { deviceId, id } = c.req.param();
    const body = c.req.valid("json");

    const session = await db.workSession.findFirst({ where: { id, deviceId } });
    if (!session) {
      return c.json({ error: { message: "משמרת לא נמצאה", code: "NOT_FOUND" } }, 404);
    }

    const updateData: Record<string, unknown> = {};
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.workplaceName !== undefined) updateData.workplaceName = body.workplaceName;

    // If ending the session
    if (body.endTime || body.status === "completed") {
      const endTime = body.endTime ? new Date(body.endTime) : new Date();
      updateData.endTime = endTime;
      updateData.status = "completed";

      // End any active breaks first
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

      // Update the session first so we can calculate totals
      await db.workSession.update({ where: { id }, data: updateData });

      // Calculate totals
      const settings = await db.settings.findUnique({ where: { deviceId } });
      const hourlyRate = settings?.hourlyRate ?? 50;
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

    // Regular update (notes, workplaceName only)
    const updated = await db.workSession.update({
      where: { id },
      data: updateData,
      include: { breaks: true },
    });
    return c.json({ data: updated });
  }
);

// PATCH /api/sessions/:deviceId/:id/edit — fully replace a completed session's times and breaks
workclockRoutes.patch(
  "/api/sessions/:deviceId/:id/edit",
  zValidator("json", editSessionSchema),
  async (c) => {
    const { deviceId, id } = c.req.param();
    const body = c.req.valid("json");

    const session = await db.workSession.findFirst({ where: { id, deviceId } });
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

    // Delete all existing breaks for this session
    await db.breakSession.deleteMany({ where: { workSessionId: id } });

    // Update the session's core fields
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

    // Recreate breaks from request body
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

    // Recalculate totals
    const settings = await db.settings.findUnique({ where: { deviceId } });
    const hourlyRate = settings?.hourlyRate ?? 50;
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

// DELETE /api/sessions/:deviceId/:id — delete session
workclockRoutes.delete("/api/sessions/:deviceId/:id", async (c) => {
  const { deviceId, id } = c.req.param();

  const session = await db.workSession.findFirst({ where: { id, deviceId } });
  if (!session) {
    return c.json({ error: { message: "משמרת לא נמצאה", code: "NOT_FOUND" } }, 404);
  }

  await db.workSession.delete({ where: { id } });
  return c.json({ data: { success: true } });
});

// ---------------------------------------------------------------------------
// Breaks
// ---------------------------------------------------------------------------

// POST /api/sessions/:deviceId/:sessionId/breaks — start break
workclockRoutes.post(
  "/api/sessions/:deviceId/:sessionId/breaks",
  zValidator("json", startBreakSchema),
  async (c) => {
    const { deviceId, sessionId } = c.req.param();
    const body = c.req.valid("json");

    const session = await db.workSession.findFirst({
      where: { id: sessionId, deviceId, status: "active" },
    });
    if (!session) {
      return c.json(
        { error: { message: "משמרת פעילה לא נמצאה", code: "SESSION_NOT_FOUND" } },
        404
      );
    }

    // Prevent two active breaks
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

// PUT /api/sessions/:deviceId/:sessionId/breaks/:breakId — end break
workclockRoutes.put(
  "/api/sessions/:deviceId/:sessionId/breaks/:breakId",
  zValidator("json", endBreakSchema),
  async (c) => {
    const { deviceId, sessionId, breakId } = c.req.param();
    const body = c.req.valid("json");

    // Verify session belongs to device
    const session = await db.workSession.findFirst({
      where: { id: sessionId, deviceId },
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

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

// GET /api/stats/:deviceId?period=week|month|year&date=YYYY-MM-DD
workclockRoutes.get("/api/stats/:deviceId", async (c) => {
  const { deviceId } = c.req.param();
  const period = c.req.query("period") ?? "week";
  const dateStr = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const refDate = new Date(dateStr + "T00:00:00.000Z");

  let startDate: Date;
  let endDate: Date;

  if (period === "week") {
    const day = refDate.getUTCDay(); // 0=Sun
    const diffToSun = day; // Sunday start
    startDate = new Date(refDate);
    startDate.setUTCDate(refDate.getUTCDate() - diffToSun);
    endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 6);
  } else if (period === "month") {
    startDate = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), 1));
    endDate = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() + 1, 0));
  } else {
    // year
    startDate = new Date(Date.UTC(refDate.getUTCFullYear(), 0, 1));
    endDate = new Date(Date.UTC(refDate.getUTCFullYear(), 11, 31));
  }

  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  const sessions = await db.workSession.findMany({
    where: {
      deviceId,
      status: "completed",
      date: { gte: startStr, lte: endStr },
    },
    orderBy: { date: "asc" },
  });

  const shiftSessions = sessions.filter(s => !s.sessionType || s.sessionType === 'shift');
  const totalHours = shiftSessions.reduce((sum, s) => sum + s.netMinutes / 60, 0);
  const totalPay = shiftSessions.reduce((sum, s) => sum + s.totalPay, 0);

  // Unique work days (shift sessions only)
  const uniqueDays = new Set(shiftSessions.map((s) => s.date));
  const workDaysCount = uniqueDays.size;
  const avgHoursPerDay = workDaysCount > 0 ? totalHours / workDaysCount : 0;

  // Daily data grouped by date (shift sessions only)
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

  // Goal progress
  const settings = await db.settings.findUnique({ where: { deviceId } });
  const dailyGoalHours = settings?.dailyGoalHours ?? 8;
  const weeklyGoalHours = settings?.weeklyGoalHours ?? 40;

  // Today's hours for daily goal
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySessions = sessions.filter((s) => s.date === todayStr);
  const todayHours = todaySessions.reduce((sum, s) => sum + s.netMinutes / 60, 0);
  const dailyGoalProgress = dailyGoalHours > 0 ? Math.min(1, todayHours / dailyGoalHours) : 0;

  // Weekly hours for weekly goal (use current week regardless of period)
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
      deviceId,
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
