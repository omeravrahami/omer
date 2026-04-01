# Monitoring Setup Guide

## Overview

The app has a fully wired monitoring layer ready for Sentry. All integration points are in place — connecting only requires adding environment variables and uncommenting a few lines.

---

## Required Environment Variables

### Backend
| Variable | Where to add | Example |
|----------|-------------|---------|
| `SENTRY_DSN` | Hosting ENV (e.g. Railway, Render, Fly.io) | `https://abc123@o123456.ingest.sentry.io/123456` |
| `LOG_LEVEL` | Hosting ENV | `info` (production), `debug` (dev) |

### Mobile
| Variable | Where to add | Example |
|----------|-------------|---------|
| `EXPO_PUBLIC_SENTRY_DSN` | Vibecode ENV tab | `https://abc123@o123456.ingest.sentry.io/123456` |

---

## Backend Monitoring (already active)

The backend logger (`backend/src/lib/logger.ts`) is already:
- Writing structured JSON logs (timestamp, level, service, message, data)
- Logging all HTTP requests (method, path, status, duration)
- Routing `error`-level logs through an `errorReporter` hook
- Ready for Sentry via `setErrorReporter()`

**To connect Sentry to the backend:**
1. Install: `bun add @sentry/node` in `backend/`
2. In `backend/src/index.ts`, add at the top:
```typescript
import * as Sentry from '@sentry/node';
import { setErrorReporter } from './lib/logger';

Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
setErrorReporter((error, context) => Sentry.captureException(error, { extra: context }));
```
3. Set `SENTRY_DSN` environment variable on your hosting platform.

---

## Mobile Monitoring (ready, needs activation)

The crash reporter (`mobile/src/lib/crash-reporter.ts`) is already:
- Called at startup: `crashReporter.init()` in `_layout.tsx`
- Setting user context on login: `crashReporter.setUser(userId)` in auth store
- Clearing user context on logout: `crashReporter.setUser(null)` in auth store
- Wrapping the app in `<ErrorBoundary>` for uncaught JS errors

**To connect Sentry to the mobile app:**
1. Add `EXPO_PUBLIC_SENTRY_DSN` via the Vibecode ENV tab
2. Uncomment Sentry lines in `mobile/src/lib/crash-reporter.ts`:
   ```typescript
   import * as Sentry from '@sentry/react-native';
   // ... then uncomment all Sentry.* calls inside the methods
   ```
3. Publish a new build via the Vibecode app (Sentry requires native build).

> Note: Sentry React Native requires a native EAS build — it will NOT work in Expo Go preview.

---

## Verifying Monitoring Works

### Backend
```bash
# Trigger a test error and check logs
curl $BACKEND_URL/api/nonexistent  # → 404 → logged as "warn"
# Check Sentry dashboard for the event
```

### Mobile
After wiring Sentry:
```typescript
// Temporarily add to any screen to test:
import { crashReporter } from '@/lib/crash-reporter';
crashReporter.captureError(new Error('Test Sentry event'));
```
Then check the Sentry dashboard for the test event.

---

## Log Levels Reference

| Level | Used for |
|-------|---------|
| `debug` | Verbose dev info (disabled in production) |
| `info` | Normal operations, HTTP requests |
| `warn` | Non-critical issues (email send fails, etc.) |
| `error` | Unexpected failures (sent to Sentry) |

---

## What's Already Logged (Backend)

- Every HTTP request: method, path, status code, duration
- Auth events: login, logout, registration, password reset, account deletion
- Admin actions: user promotion, suspension, config changes
- Unhandled errors: full error object + request context
- Session events: token expired, invalid token

## What's Already Logged (Mobile)

- Crashes via `<ErrorBoundary>` component
- Manual `crashReporter.captureError()` calls in error handlers
- User context (ID) is set/cleared on login/logout
