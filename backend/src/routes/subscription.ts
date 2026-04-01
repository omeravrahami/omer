import { Hono } from "hono";

type AuthVariables = { userId: string };

export const subscriptionRouter = new Hono<{ Variables: AuthVariables }>();

// ---------------------------------------------------------------------------
// Subscription / Premium — architecture notes
// ---------------------------------------------------------------------------
//
// Current state: READY BUT NOT CONNECTED
//
// The premium/subscription system is split into two halves:
//
// 1. Backend (this file + admin.ts):
//    - The `isPremium` boolean lives on the User model (prisma/schema.prisma).
//    - Admins can manually toggle a user's isPremium flag via:
//        PUT /api/admin/users/:id  { "isPremium": true }
//    - Subscription stats (total users, premium count, conversion rate) are
//      available at GET /api/admin/subscriptions/stats (see admin.ts).
//    - AppConfig keys: premium_enabled, retention_months_free,
//      premium_price_monthly, ads_enabled (seeded by POST /api/admin/setup).
//
// 2. Mobile (mobile/src/app/premium.tsx):
//    - The Premium screen shows features and price ($9.99/month).
//    - "Upgrade" and "Restore Purchase" buttons are present but do nothing
//      (they are explicit placeholders — see handleUpgrade / handleRestore).
//    - isPremium state comes from useSettingsStore (synced with backend on login).
//    - Ads are disabled for premium users via isAdEnabled(isPremium) in ads/index.ts.
//    - History is gated for free users via LockedHistoryBanner (retention_months_free).
//
// What's needed to go live:
//    - Integrate RevenueCat (or App Store / Google Play native IAP).
//    - On successful purchase, call a backend endpoint to set isPremium=true
//      for the authenticated user. A dedicated endpoint can be added here.
//    - On restore, validate the receipt and update the flag the same way.
//
// This router is kept as a placeholder. Add endpoints here when IAP is wired.
// ---------------------------------------------------------------------------

export default subscriptionRouter;
