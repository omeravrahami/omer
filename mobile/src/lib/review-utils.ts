import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  firstShiftDone: 'review_first_shift_done',
  firstShiftShown: 'review_shown_first',
  lastWeeklyTs: 'review_last_weekly_ts',
  pendingShow: 'review_pending_show',
} as const;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Called after a new shift is created (not when editing).
 * Sets AsyncStorage flags and queues a review prompt if timing is right.
 */
export async function markShiftCreatedAndCheckReview(): Promise<void> {
  const firstDone = await AsyncStorage.getItem(KEYS.firstShiftDone);

  if (!firstDone) {
    // This is the first shift ever saved
    await AsyncStorage.setItem(KEYS.firstShiftDone, 'true');
    const firstShown = await AsyncStorage.getItem(KEYS.firstShiftShown);
    if (!firstShown) {
      await AsyncStorage.setItem(KEYS.firstShiftShown, 'true');
      await AsyncStorage.setItem(KEYS.pendingShow, 'true');
    }
    return;
  }

  // Not the first shift — check weekly cadence
  const lastTs = await AsyncStorage.getItem(KEYS.lastWeeklyTs);
  const now = Date.now();

  if (!lastTs || now - parseInt(lastTs, 10) > SEVEN_DAYS_MS) {
    await AsyncStorage.setItem(KEYS.lastWeeklyTs, String(now));
    await AsyncStorage.setItem(KEYS.pendingShow, 'true');
  }
}

/**
 * Called when the home screen gains focus.
 * Returns true if a review prompt should be displayed, and clears the flag.
 */
export async function checkAndClearPendingReview(): Promise<boolean> {
  const pending = await AsyncStorage.getItem(KEYS.pendingShow);
  if (pending === 'true') {
    await AsyncStorage.removeItem(KEYS.pendingShow);
    return true;
  }
  return false;
}
