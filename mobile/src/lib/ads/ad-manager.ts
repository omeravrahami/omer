/**
 * ad-manager.ts
 *
 * Manages ad display frequency using AsyncStorage for persistence.
 * Pure JS — no native code required.
 *
 * Strategy:
 *  - Interstitial shows every 3rd session end
 *  - Screen transitions are tracked but only used for future rules
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_SESSION_COUNT = '@ad_manager/session_end_count';
const STORAGE_KEY_SCREEN_TRANSITIONS = '@ad_manager/screen_transitions';

const INTERSTITIAL_FREQUENCY = 3; // show every Nth session end

/**
 * Call this when a work session ends.
 * Returns true if an interstitial should be shown this time.
 */
export async function trackSessionEnd(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_SESSION_COUNT);
    const count = raw !== null ? parseInt(raw, 10) : 0;
    const newCount = count + 1;
    await AsyncStorage.setItem(STORAGE_KEY_SESSION_COUNT, String(newCount));
    return newCount % INTERSTITIAL_FREQUENCY === 0;
  } catch {
    return false;
  }
}

/**
 * Track a screen transition. Useful for future ad rules.
 */
export async function trackScreenTransition(screen: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_SCREEN_TRANSITIONS);
    const transitions: string[] = raw !== null ? JSON.parse(raw) : [];
    // Keep last 20 transitions to avoid unbounded growth
    const updated = [...transitions, screen].slice(-20);
    await AsyncStorage.setItem(STORAGE_KEY_SCREEN_TRANSITIONS, JSON.stringify(updated));
  } catch {
    // Silently fail — ads are non-critical
  }
}

/**
 * Check whether an interstitial should be shown now,
 * based on the current session end count without incrementing it.
 */
export async function shouldShowInterstitial(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_SESSION_COUNT);
    const count = raw !== null ? parseInt(raw, 10) : 0;
    return count > 0 && count % INTERSTITIAL_FREQUENCY === 0;
  } catch {
    return false;
  }
}

/**
 * Reset the interstitial counter.
 * Useful for testing or when the user upgrades to a paid tier.
 */
export async function resetInterstitialCount(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_SESSION_COUNT, '0');
  } catch {
    // Silently fail
  }
}
