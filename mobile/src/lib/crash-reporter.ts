/**
 * Mobile crash/error reporter abstraction.
 *
 * Currently a no-op stub — ready to plug in Sentry with one step:
 *
 *   1. Add your DSN to the ENV tab: EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
 *   2. Uncomment the Sentry lines below (already written for you).
 *   3. Publish a new build via the Vibecode app.
 *
 * The rest of the app imports only from this file, so the switch is one-place.
 *
 * Note: @sentry/react-native requires a native build (EAS). It cannot be tested
 * in Expo Go — use the Vibecode publish flow to get a testable build.
 */

// import * as Sentry from '@sentry/react-native';

export type CrashReporterContext = Record<string, unknown>;

export const crashReporter = {
  /** Call once at app startup (in _layout.tsx) */
  init(): void {
    // Sentry.init({
    //   dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    //   environment: __DEV__ ? 'development' : 'production',
    //   tracesSampleRate: 0.2,
    //   attachScreenshot: true,
    // });
  },

  /** Log a non-fatal error */
  captureError(error: unknown, context?: CrashReporterContext): void {
    if (__DEV__) {
      console.error('[crash]', error, context);
    }
    // Sentry.captureException(error, { extra: context });
  },

  /** Log a breadcrumb / informational event */
  log(message: string, context?: CrashReporterContext): void {
    if (__DEV__) {
      console.log('[crash]', message, context);
    }
    // Sentry.addBreadcrumb({ message, data: context });
  },

  /** Set the currently logged-in user (for grouping errors in Sentry dashboard) */
  setUser(id: string | null): void {
    // Sentry.setUser(id ? { id } : null);
  },
};
