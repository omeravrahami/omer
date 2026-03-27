// Google AdMob Unit IDs
// Use TEST IDs during development, replace with real IDs before production

export const AD_CONFIG = {
  // Test IDs (safe for development - always use these in test/dev builds)
  TEST_IDS: {
    BANNER: 'ca-app-pub-3940256099942544/6300978111',
    INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
    REWARDED: 'ca-app-pub-3940256099942544/5224354917',
  },

  // Production IDs - replace before App Store submission
  // Get these from your Google AdMob console: https://apps.admob.com
  PRODUCTION_IDS: {
    BANNER: '', // TODO: Add from AdMob console
    INTERSTITIAL: '', // TODO: Add from AdMob console
    REWARDED: '', // TODO: Add from AdMob console
  },
} as const;

// Display rules
export const AD_DISPLAY_RULES = {
  // Show interstitial after every N work sessions ended
  INTERSTITIAL_AFTER_SESSIONS: 3,
  // Minimum seconds between interstitial ads
  INTERSTITIAL_MIN_INTERVAL_SECONDS: 180,
  // Show banner on: dashboard, stats, history screens
  BANNER_SCREENS: ['dashboard', 'stats', 'history'],
  // Never show ads on these screens
  AD_FREE_SCREENS: ['clock', 'settings', 'admin'],
} as const;

// Helper: get the appropriate ad unit ID based on test mode
export function getAdUnitId(
  type: 'BANNER' | 'INTERSTITIAL' | 'REWARDED',
  testMode: boolean = true
): string {
  if (testMode) return AD_CONFIG.TEST_IDS[type];
  return AD_CONFIG.PRODUCTION_IDS[type] || AD_CONFIG.TEST_IDS[type];
}
