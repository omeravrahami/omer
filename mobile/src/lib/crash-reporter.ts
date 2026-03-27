/**
 * Mobile crash/error reporter abstraction.
 *
 * Drop in a real provider (e.g. Sentry) by replacing the no-op functions below.
 * The rest of the app imports only from this file, so the switch is one-place.
 *
 * To enable Sentry:
 *   1. Install:  bun add @sentry/react-native
 *   2. Add EXPO_PUBLIC_SENTRY_DSN to mobile/.env
 *   3. Replace the stubs below with real Sentry calls.
 */

export type CrashReporterContext = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Stub implementation — replace with real provider in production
// ---------------------------------------------------------------------------

export const crashReporter = {
  /** Call once at app startup (e.g. in _layout.tsx) */
  init(): void {
    // Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN });
  },

  /** Log a non-fatal error */
  captureError(error: unknown, context?: CrashReporterContext): void {
    if (__DEV__) {
      console.error('[crashReporter]', error, context);
    }
    // Sentry.captureException(error, { extra: context });
  },

  /** Log a breadcrumb / informational event */
  log(message: string, context?: CrashReporterContext): void {
    if (__DEV__) {
      console.log('[crashReporter]', message, context);
    }
    // Sentry.addBreadcrumb({ message, data: context });
  },

  /** Set the currently logged-in user (for grouping errors in dashboard) */
  setUser(id: string | null): void {
    // Sentry.setUser(id ? { id } : null);
  },
};
