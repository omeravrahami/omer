import { Hono } from "hono";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";

type AuthVariables = { userId: string };

export const subscriptionRouter = new Hono<{ Variables: AuthVariables }>();

// GET /api/subscription/status — get current user's subscription status
subscriptionRouter.get("/status", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;
  const settings = await db.userSettings.findUnique({
    where: { userId },
    select: {
      isPremium: true,
      subscriptionStatus: true,
      subscriptionStartDate: true,
      subscriptionEndDate: true,
      planType: true,
    },
  });

  if (!settings) {
    return c.json({ data: { isPremium: false, subscriptionStatus: "free", planType: "free" } });
  }

  // Auto-expire subscription if past end date
  if (settings.isPremium && settings.subscriptionEndDate && new Date() > settings.subscriptionEndDate) {
    await db.userSettings.update({
      where: { userId },
      data: { isPremium: false, subscriptionStatus: "expired" },
    });
    return c.json({ data: { ...settings, isPremium: false, subscriptionStatus: "expired" } });
  }

  return c.json({ data: settings });
});

// GET /api/subscription/config — get subscription pricing config (public)
subscriptionRouter.get("/config", async (c) => {
  const configs = await db.appConfig.findMany({
    where: {
      key: { in: ["premium_price_monthly", "premium_enabled", "retention_months_free", "ads_enabled"] },
    },
  });

  const result: Record<string, string> = {};
  for (const config of configs) {
    result[config.key] = config.value;
  }

  // Defaults if not set
  return c.json({
    data: {
      premium_price_monthly: result.premium_price_monthly ?? "9.99",
      premium_enabled: result.premium_enabled ?? "true",
      retention_months_free: result.retention_months_free ?? "3",
      ads_enabled: result.ads_enabled ?? "true",
    },
  });
});

export default subscriptionRouter;
