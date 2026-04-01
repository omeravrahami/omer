import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { db } from "../db";
import { logger } from "../lib/logger";

type AuthVariables = { userId: string };

export const subscriptionRouter = new Hono<{ Variables: AuthVariables }>();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const syncSchema = z.object({
  platform: z.enum(["ios", "android"]),
  receiptData: z.string().min(1, "receiptData is required"),
  productId: z.string().min(1, "productId is required"),
});

// ---------------------------------------------------------------------------
// GET /api/subscription/status — current user's subscription state
// ---------------------------------------------------------------------------

subscriptionRouter.get("/status", authMiddleware, async (c) => {
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

  const now = new Date();
  const isAdmin = userRecord?.role === "ADMIN";
  const rawIsPremium = userSettings?.isPremium ?? false;
  const subscriptionEndDate = userSettings?.subscriptionEndDate ?? null;
  const isExpired = rawIsPremium && subscriptionEndDate != null && subscriptionEndDate < now;
  const isPremium = isAdmin || (rawIsPremium && !isExpired);

  return c.json({
    data: {
      isPremium,
      subscriptionStatus: isAdmin
        ? "admin"
        : (userSettings?.subscriptionStatus ?? "free"),
      planType: isAdmin ? "admin" : (userSettings?.planType ?? "free"),
      platform: null,
      subscriptionStartDate: userSettings?.subscriptionStartDate?.toISOString() ?? null,
      subscriptionEndDate: subscriptionEndDate?.toISOString() ?? null,
      isExpired,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/subscription/sync — update subscription from IAP receipt
// ---------------------------------------------------------------------------

subscriptionRouter.post(
  "/sync",
  authMiddleware,
  zValidator("json", syncSchema),
  async (c) => {
    const userId = c.get("userId");
    const { platform, receiptData, productId } = c.req.valid("json");

    // Placeholder: real IAP validation will be plugged in later.
    // For now, trust the client and set isPremium=true.
    logger.info("subscription sync", { userId, platform, productId });

    const now = new Date();
    // Default subscription end: 1 month from now
    const subscriptionEndDate = new Date(now);
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

    const settings = await db.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        isPremium: true,
        subscriptionStatus: "active",
        planType: "premium",
        subscriptionStartDate: now,
        subscriptionEndDate,
      },
      update: {
        isPremium: true,
        subscriptionStatus: "active",
        planType: "premium",
        subscriptionStartDate: now,
        subscriptionEndDate,
      },
    });

    return c.json({
      data: {
        isPremium: settings.isPremium,
        subscriptionStatus: settings.subscriptionStatus,
        planType: settings.planType,
        subscriptionStartDate: settings.subscriptionStartDate?.toISOString() ?? null,
        subscriptionEndDate: settings.subscriptionEndDate?.toISOString() ?? null,
        platform,
        productId,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// POST /api/subscription/restore — restore purchases (placeholder)
// ---------------------------------------------------------------------------

subscriptionRouter.post("/restore", authMiddleware, async (c) => {
  const userId = c.get("userId");

  logger.info("subscription restore requested", { userId });

  const userSettings = await db.userSettings.findUnique({
    where: { userId },
    select: {
      isPremium: true,
      subscriptionStatus: true,
      planType: true,
      subscriptionStartDate: true,
      subscriptionEndDate: true,
    },
  });

  // Placeholder: real restore will validate receipts with App Store / Google Play.
  // For now, return current state.
  return c.json({
    data: {
      restored: false,
      isPremium: userSettings?.isPremium ?? false,
      subscriptionStatus: userSettings?.subscriptionStatus ?? "free",
      planType: userSettings?.planType ?? "free",
      subscriptionStartDate: userSettings?.subscriptionStartDate?.toISOString() ?? null,
      subscriptionEndDate: userSettings?.subscriptionEndDate?.toISOString() ?? null,
    },
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/subscription/cancel — mark subscription as canceled
// ---------------------------------------------------------------------------

subscriptionRouter.delete("/cancel", authMiddleware, async (c) => {
  const userId = c.get("userId");

  logger.info("subscription cancel", { userId });

  const settings = await db.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      isPremium: false,
      subscriptionStatus: "canceled",
      planType: "free",
    },
    update: {
      subscriptionStatus: "canceled",
    },
  });

  return c.json({
    data: {
      isPremium: settings.isPremium,
      subscriptionStatus: settings.subscriptionStatus,
      planType: settings.planType,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/subscription/config — public pricing configuration
// ---------------------------------------------------------------------------

subscriptionRouter.get("/config", async (c) => {
  const configs = await db.appConfig.findMany({
    where: {
      key: {
        in: ["premium_price_monthly", "premium_enabled", "retention_months_free", "ads_enabled"],
      },
    },
  });

  const configMap: Record<string, string> = {};
  for (const cfg of configs) {
    configMap[cfg.key] = cfg.value;
  }

  return c.json({
    data: {
      premium_price_monthly: configMap["premium_price_monthly"] ?? "9.99",
      premium_enabled: configMap["premium_enabled"] ?? "true",
      retention_months_free: configMap["retention_months_free"] ?? "3",
      ads_enabled: configMap["ads_enabled"] ?? "true",
    },
  });
});

export default subscriptionRouter;
