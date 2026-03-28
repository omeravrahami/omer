# WorkClock

A Hebrew RTL time-tracking application for employees, freelancers, and students. The app is free and ad-supported (AdMob). It features real-time shift timers, break tracking, automatic pay calculation, session history, analytics, and a full Israeli tax and salary engine.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tax and Salary Engine](#tax-and-salary-engine)
4. [Mobile Features](#mobile-features)
5. [User Management](#user-management)
6. [Roles and Permissions](#roles-and-permissions)
7. [Admin Panel](#admin-panel)
8. [Database Tables](#database-tables)
9. [API Endpoints](#api-endpoints)
10. [Environment Variables](#environment-variables)
11. [Email Setup (Resend)](#email-setup-resend)
12. [Creating the First Admin](#creating-the-first-admin)
13. [Security Features](#security-features)
14. [QA Checklist](#qa-checklist)
15. [Managing the System](#managing-the-system)
16. [Deployment Notes](#deployment-notes)

---

## Project Overview

WorkClock is a bilingual (Hebrew-first) time tracking app. Users clock in and out of work shifts, track breaks, record notes and workplace names, and view earnings calculated from their hourly rate. All data is stored per authenticated user account, enabling full cross-device sync. There is no guest/deviceId mode — all business data requires a user account.

Key features:

- Live shift timer with pulse animation
- Break tracking within active sessions
- Automatic gross/net pay calculation with full Israeli tax breakdown
- Session types: regular shift, sick day, vacation
- Month navigation for session history
- Weekly and monthly analytics with goal progress bars
- Simulation screen (סימולטור שעות) — shows projected net earnings for extra hours
- Dynamic economic insights cards on the home screen
- User accounts with email/password, plus guest (device-only) mode
- Cross-device sync when logged in
- Full RTL Hebrew interface with dark mode
- Admin panel for user and system management
- Privacy and Terms screen
- Ad-supported via AdMob with frequency-controlled ad manager

---

## Tax and Salary Engine

WorkClock includes a complete Israeli payroll engine updated to **2026 tax rates**.

### Tax engine (`calcTax`)

- Income tax brackets updated for 2026
- Credit point value updated for 2026
- National Insurance (Bituach Leumi) with the 2026 ceiling
- Health insurance deduction
- Supports credit points (default 2.25 for a single employee)

### Salary breakdown (`calcSalaryBreakdown`)

Each salary component carries flags that control how it participates in calculations:

| Flag | Meaning |
|------|---------|
| `includedInRegularGross` | Component counts toward standard gross |
| `includedInTaxGross` | Component is taxable |
| `includedInNet` | Component appears in the net take-home amount |
| `includedInSocialSecurity` | Component is subject to NI / health insurance |

The function returns a full breakdown: gross, taxable gross, income tax, NI, health insurance, total deductions, and net pay — with each component annotated by its flags.

### Simulation screen

The "סימולטור שעות" (hours simulator) screen lets a user enter additional hours and immediately see the projected gross and net impact on their next paycheck, using the same tax engine.

---

## Mobile Features

### InsightsCards

A horizontally-scrollable card strip on the home screen that surfaces dynamic economic insights (effective tax rate, monthly projection, hours-to-goal, etc.) derived from the user's real session data.

### SalaryBreakdownCard

Displays the detailed salary breakdown from `calcSalaryBreakdown`. Each component is shown with colored tags indicating which flags apply (taxable, included in net, etc.).

### MoneyCharacter

An animated ₪ bill character built with `react-native-reanimated`. Supports four states:

| State | Behavior |
|-------|---------|
| `idle` | Gentle float/pulse |
| `working` | Active motion |
| `break` | Slow breathing animation |
| `done` | Celebration bounce |
| `sleeping` | Slow fade/droop |

Visibility is controlled by the `showCharacter` toggle in user settings.

### AdMob infrastructure

- Test ad unit IDs wired into the AdMob components during development
- Ad manager utility handles display frequency (prevents over-serving ads)
- Ad components live in `mobile/src/components/ads/`

### Privacy and Terms screen

A dedicated in-app screen for Privacy Policy and Terms of Service, accessible from the settings tab.

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Mobile app | Expo SDK 53, React Native, NativeWind (Tailwind) |
| Backend API | Hono web framework, Bun runtime |
| Database | Prisma ORM, SQLite (`dev.db`) |
| Auth | Custom token-based auth (bcryptjs, DB sessions) |
| State management | React Query (server state), Zustand (local state) |
| Email | Resend (optional) |

```
workspace/
  mobile/   — Expo React Native app (port 8081)
  backend/  — Hono + Bun + Prisma API server (port 3000)
```

The backend exposes a JSON REST API. All responses are wrapped in `{ data: ... }` except for error responses which use `{ error: { message, code } }`.

---

## User Management

### Registration

`POST /api/auth/register`

Users register with an email, password, and optional username. A session token is returned on success. A welcome email is sent if Resend is configured.

Password requirements:
- Minimum 8 characters
- Must contain at least one digit or special character

### Login

`POST /api/auth/login`

Accepts an email or username as the identifier. On success returns a bearer token valid for 30 days. Suspended or disabled accounts are rejected.

### Logout

`POST /api/auth/logout`

Deletes the current session token from the database.

### Forgot Password Flow

1. User submits their email to `POST /api/auth/forgot-password`
2. A one-time reset token is generated (valid 1 hour)
3. An email with the reset link is sent if Resend is configured
4. In non-production environments, the token is also returned in the response for testing
5. User submits the token and new password to `POST /api/auth/reset-password`
6. All existing sessions are invalidated on successful reset, forcing re-login on all devices

### Multi-Device Support

Each login creates an independent `UserSession` record with optional `deviceName` and `platform` fields. Users can view all active sessions and revoke individual ones (except the current session) via the sessions endpoints.

### Email Verification

Users can request a verification email via `POST /api/auth/send-verification`. The verification token is valid for 6 hours. In non-production, the token is returned in the response for testing. Verification is confirmed via `POST /api/auth/verify-email`.

### Account Deletion

`DELETE /api/auth/account` performs a soft delete: the email is anonymized, the account is set to DISABLED, and all sessions are removed. Password confirmation is required.

---

## Roles and Permissions

| Role | Access |
|------|--------|
| `USER` | Own profile, own work sessions, own settings, own device sessions |
| `ADMIN` | Full system access: all users, all statistics, app config, admin operations |

### USER role

A regular user can:

- Register, login, logout
- View and edit their own profile
- Change their password
- List and revoke their own sessions
- Get and update their cloud settings (synced across devices)
- Manage their own work sessions and breaks via the device-scoped work session endpoints

A regular user cannot:
- Access any `/api/admin/*` endpoint
- View or modify other users' data

### ADMIN role

An admin can do everything a user can, plus:

- List all users with pagination and search
- View full detail for any user including their recent sessions
- Update any user's status (ACTIVE, SUSPENDED, DISABLED) or role (USER, ADMIN)
- Trigger a password reset for any user (returns a reset token directly)
- Force-revoke all sessions for any user
- View system-wide statistics (total users, active users, registrations over time)
- Read and update the application configuration key-value store

---

## Admin Panel

The admin panel is accessed through the mobile app when logged in as an admin. The app detects the `ADMIN` role from the `/api/auth/me` response and shows the admin tab.

**Default admin credentials:**

| Field | Value |
|-------|-------|
| Email | `admin@workclock.com` |
| Password | `Admin123!` |

If the admin user does not yet exist, create it with the setup endpoint described in [Creating the First Admin](#creating-the-first-admin).

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `User` | Registered user accounts with email, password hash, role, and status |
| `UserSession` | Auth tokens per device/login. One user can have many active sessions |
| `PasswordResetToken` | One-time tokens for both password reset and email verification flows |
| `AppConfig` | Key-value store for runtime app configuration (e.g. min wage, VAT rate) |
| `UserSettings` | Per-user preferences synced to the cloud (hourly rate, goals, theme) |
| `Settings` | Per-device preferences used in guest mode (not tied to a user account) |
| `WorkSession` | Individual work session records with start/end times, break totals, and pay |
| `BreakSession` | Break records within a work session |

### Default AppConfig values

Seeded when the first admin is created via `/api/admin/setup`:

| Key | Default Value | Description |
|-----|---------------|-------------|
| `tip_percentage` | `12` | Default tip percentage |
| `min_wage` | `32.30` | Israeli minimum wage per hour (ILS) |
| `vat_rate` | `18` | Israeli VAT percentage |
| `app_name` | `WorkClock` | Application name |
| `support_email` | `support@workclock.app` | Support contact email |

---

## API Endpoints

All endpoints return `{ data: ... }` on success or `{ error: { message, code } }` on failure. Authentication is via `Authorization: Bearer <token>` header.

### Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | None | Server health check |

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | None | Register a new user account |
| POST | `/api/auth/login` | None | Login with email or username |
| POST | `/api/auth/logout` | None | Invalidate current session token |
| GET | `/api/auth/me` | Required | Get current user profile |
| PUT | `/api/auth/profile` | Required | Update username or email |
| POST | `/api/auth/change-password` | Required | Change password (requires current password) |
| DELETE | `/api/auth/account` | Required | Soft-delete account (requires password confirmation) |
| POST | `/api/auth/forgot-password` | None | Request a password reset email |
| POST | `/api/auth/reset-password` | None | Reset password using a valid token |
| POST | `/api/auth/send-verification` | Required | Send email verification link |
| POST | `/api/auth/verify-email` | None | Confirm email address with token |
| GET | `/api/auth/sessions` | Required | List all active sessions for current user |
| DELETE | `/api/auth/sessions/:sessionId` | Required | Revoke a specific session |
| GET | `/api/auth/user-settings` | Required | Get cloud-synced user settings |
| PUT | `/api/auth/user-settings` | Required | Save cloud-synced user settings |

### Admin (ADMIN role required, except setup)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/admin/setup` | None | Create the first admin account (one-time only) |
| GET | `/api/admin/users` | ADMIN | List all users (paginated, searchable) |
| GET | `/api/admin/users/:id` | ADMIN | Get full user detail including recent sessions |
| PUT | `/api/admin/users/:id` | ADMIN | Update user role or status |
| POST | `/api/admin/users/:id/reset-password` | ADMIN | Generate a password reset token for any user |
| DELETE | `/api/admin/users/:id/sessions` | ADMIN | Revoke all sessions for a user |
| GET | `/api/admin/stats` | ADMIN | System-wide statistics and registration chart |
| GET | `/api/admin/config` | ADMIN | Read all app config key-value pairs |
| PUT | `/api/admin/config/:key` | ADMIN | Create or update a config value |

### Work Sessions (user-scoped, auth required)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/user/settings` | Required | Get user settings |
| PUT | `/api/user/settings` | Required | Update user settings |
| GET | `/api/user/sessions` | Required | List sessions (optional `?month=YYYY-MM&status=active\|completed`) |
| GET | `/api/user/sessions/active` | Required | Get the currently active session |
| GET | `/api/user/sessions/:id` | Required | Get a single session with breaks |
| POST | `/api/user/sessions` | Required | Start a new session or create a completed manual entry |
| PUT | `/api/user/sessions/:id` | Required | End or update a session |
| PATCH | `/api/user/sessions/:id/edit` | Required | Fully replace a session's times and breaks |
| DELETE | `/api/user/sessions/:id` | Required | Delete a session |
| POST | `/api/user/sessions/:sessionId/breaks` | Required | Start a break within an active session |
| PUT | `/api/user/sessions/:sessionId/breaks/:breakId` | Required | End a break |
| GET | `/api/user/stats` | Required | Get stats for a period (`?period=week\|month\|year&date=YYYY-MM-DD`) |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: `3000`) |
| `NODE_ENV` | No | Environment (`development`, `production`) |
| `BACKEND_URL` | No | Full backend base URL (default: `http://localhost:3000`) |
| `DATABASE_URL` | No | Prisma database URL (defaults to SQLite `file:./dev.db` in schema) |
| `RESEND_API_KEY` | No | Resend API key for transactional email. Email is silently skipped if not set |
| `SETUP_SECRET` | Recommended in prod | Secret required in `x-setup-secret` header to call `POST /api/admin/setup`. If not set, setup is open (logs a warning) |

Example `backend/.env`:

```
PORT=3000
NODE_ENV=development
BACKEND_URL=https://your-backend.vibecode.run
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

### Mobile (`mobile/.env` or Expo config)

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_BACKEND_URL` | Yes | Full URL of the backend API (bundled at build time) |

Example:

```
EXPO_PUBLIC_BACKEND_URL=https://your-backend.vibecode.run
```

---

## Email Setup (Resend)

WorkClock uses [Resend](https://resend.com) for transactional email. Email is optional — all auth flows work without it, but users will not receive emails.

To enable email:

1. Create a free Resend account at https://resend.com
2. Create an API key in the Resend dashboard
3. Add the key to `backend/.env`:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
   ```
4. Restart the backend server

Emails sent by the system:

| Trigger | Email type |
|---------|-----------|
| New user registration | Welcome email |
| Forgot password request | Password reset link |
| Email verification request | Verification link |

In non-production environments (`NODE_ENV` is not `production`), the reset and verification tokens are returned directly in the API response so they can be used for testing without email configured.

---

## Creating the First Admin

If no admin exists yet, use the public setup endpoint. Set `SETUP_SECRET` in the backend `.env` first, then pass it as the `x-setup-secret` header. The endpoint returns `409 ADMIN_EXISTS` if any admin already exists.

```bash
curl -X POST $BACKEND_URL/api/admin/setup \
  -H "Content-Type: application/json" \
  -H "x-setup-secret: YOUR_SETUP_SECRET" \
  -d '{
    "email": "admin@workclock.com",
    "password": "Admin123!",
    "username": "admin"
  }'
```

A successful response returns a session token and the created user object. Save the token to use admin endpoints directly.

The setup call also seeds the default `AppConfig` values (min wage, VAT rate, etc.).

---

## Audit Logging

All sensitive admin and auth actions are recorded to the `AuditLog` table automatically:

| Action | Trigger |
|--------|---------|
| `LOGIN` | Successful user login |
| `CHANGE_PASSWORD` | Password changed by user |
| `DELETE_ACCOUNT` | Account deleted (soft-delete) |
| `ADMIN_SETUP` | First admin account created |
| `UPDATE_USER` | Admin changed user role or status |
| `RESET_USER_PASSWORD` | Admin triggered password reset for a user |

---

## Test Suite

The backend includes an integration test suite using Bun's built-in test runner:

```bash
cd backend && bun test src/tests/
```

Test files:
- `src/tests/auth.test.ts` — Registration, login, account deletion
- `src/tests/sessions.test.ts` — Work session CRUD and auth guards
- `src/tests/admin.test.ts` — Admin setup, access control, and user management

---

- **Password hashing**: bcryptjs with a cost factor of 12
- **Token-based sessions**: UUID tokens stored in the database; validated on every request
- **Session expiry**: All session tokens expire after 30 days
- **Rate limiting**: Auth endpoints (register, login, forgot password) are rate-limited to prevent brute force
- **Stricter limit on reset**: Password reset endpoint has a tighter rate limit
- **Suspended/disabled account blocking**: Login is rejected for non-ACTIVE accounts
- **Admin middleware**: All `/api/admin/*` routes (except `/setup`) verify the `ADMIN` role
- **Setup secret gate**: `POST /api/admin/setup` requires `x-setup-secret` header when `SETUP_SECRET` env var is set
- **Audit logging**: All admin and critical auth operations are recorded to `AuditLog`
- **CORS allowlist**: Origin-echo CORS with a strict allowlist for localhost, Vibecode, and VibecodeApp domains; wildcard `*` is never sent with credentials
- **Soft delete**: Account deletion anonymizes data rather than hard-deleting, preserving referential integrity
- **Delete confirmation**: Account deletion requires password re-entry in both the app and via the web deletion link
- **Token single-use**: Password reset and email verification tokens are marked `usedAt` after first use
- **Session invalidation on password reset**: All existing sessions are deleted when a password is successfully reset
- **All business routes require auth**: No device-scoped (deviceId) API routes exist; every route requires a valid user token

---

## QA Checklist

| Feature | Status |
|---------|--------|
| User registration (email + password) | PASS |
| Duplicate email rejected | PASS |
| Login with email | PASS |
| Login with username | PASS |
| Login rejected for wrong password | PASS |
| Login rejected for suspended account | PASS |
| Session token returned on login | PASS |
| Logout invalidates token | PASS |
| GET /api/auth/me with valid token | PASS |
| GET /api/auth/me with invalid token returns 401 | PASS |
| Forgot password generates token | PASS |
| Reset password with valid token | PASS |
| Reset password with expired token returns 400 | PASS |
| All sessions deleted after password reset | PASS |
| Email verification token generated | PASS |
| Email verification with valid token | PASS |
| Admin setup creates first admin | PASS |
| Admin setup blocked if admin already exists | PASS |
| GET /api/admin/users requires ADMIN role | PASS |
| Non-admin token returns 403 on admin routes | PASS |
| User status update (SUSPENDED/ACTIVE) | PASS |
| Admin force-reset user password | PASS |
| Admin revoke all user sessions | PASS |
| GET /api/admin/stats returns user counts | PASS |
| GET /api/admin/config returns config values | PASS |
| Work session start (live) | PASS |
| Work session end with totals calculated | PASS |
| Break start within active session | PASS |
| Break end with duration calculated | PASS |
| Prevent two active sessions | PASS |
| Prevent two active breaks | PASS |
| Manual session entry (start + end time provided) | PASS |
| Sick/vacation day entry | PASS |
| Session edit (PATCH) replaces times and breaks | PASS |
| Session delete | PASS |
| Stats endpoint returns week/month/year summaries | PASS |
| Multi-device session listing | PASS |
| Revoke individual session | PASS |
| Cannot revoke current session | PASS |
| Rate limiting on auth endpoints | PASS |

---

## Managing the System

### View all users

```bash
curl $BACKEND_URL/api/admin/users \
  -H "Authorization: Bearer <admin_token>"
```

Add `?search=term` to filter by email or username. Add `?page=2&limit=50` for pagination.

### Suspend a user

```bash
curl -X PUT $BACKEND_URL/api/admin/users/<userId> \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "SUSPENDED"}'
```

Valid status values: `ACTIVE`, `SUSPENDED`, `DISABLED`

### Promote a user to admin

```bash
curl -X PUT $BACKEND_URL/api/admin/users/<userId> \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "ADMIN"}'
```

### Force-reset a user's password

```bash
curl -X POST $BACKEND_URL/api/admin/users/<userId>/reset-password \
  -H "Authorization: Bearer <admin_token>"
```

Returns a `resetToken` that can be passed directly to `/api/auth/reset-password`.

### Update app config

```bash
curl -X PUT $BACKEND_URL/api/admin/config/min_wage \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"value": "33.50", "description": "Updated minimum wage"}'
```

### View system stats

```bash
curl $BACKEND_URL/api/admin/stats \
  -H "Authorization: Bearer <admin_token>"
```

Returns total users, active users, suspended users, admin count, total sessions, and a 7-day registration chart.

---

## Deployment Notes

- **Database**: The Prisma schema uses SQLite by default (`file:./dev.db`). For production, consider switching to PostgreSQL by updating the `datasource` block in `backend/prisma/schema.prisma` and setting `DATABASE_URL` accordingly.
- **Schema migrations**: Use `bunx prisma db push` for development and preview environments. Use `bunx prisma migrate deploy` in production.
- **Prisma client**: The start script runs `bunx prisma generate` automatically if `schema.prisma` is present. If routes return 404 but `/health` works, the Prisma client may not have been generated — run `bunx prisma generate` and restart.
- **Environment variables**: Never use `EXPO_PUBLIC_*` variables in backend code. Never use backend-only secrets in the mobile bundle.
- **Token security**: Store session tokens securely on the client (SecureStore on mobile). Never log tokens.
- **CORS**: The backend echoes the specific origin rather than using `*`, which is required for requests sent with `credentials: include`.
- **Email in production**: Set `NODE_ENV=production` to prevent reset and verification tokens from being exposed in API responses.
- **AdMob**: Production ad unit IDs are read from ENV vars (`EXPO_PUBLIC_ADMOB_BANNER_ID`, `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID`, `EXPO_PUBLIC_ADMOB_REWARDED_ID`). Set `enabled: true` in `mobile/src/lib/ads/index.ts` once an AdMob account is configured and EAS build is ready.

---

## Store Submission Checklist

### Legal pages (already live at backend URL)
- **Privacy Policy**: `$BACKEND_URL/privacy` — full Hebrew privacy policy
- **Delete Account**: `$BACKEND_URL/delete-account` — App Store / Play Store required page

### What's ready
- [x] Privacy Policy web page (`/privacy`)
- [x] Delete Account web page (`/delete-account`)
- [x] In-app delete account flow (Settings → מחיקת חשבון)
- [x] In-app Privacy link (Settings footer → פרטיות ותנאי שימוש)
- [x] Crash reporter stub ready for Sentry (see `mobile/src/lib/crash-reporter.ts`)
- [x] AdMob test IDs wired (official Google test IDs, safe for review)
- [x] AdMob production ID slots ready (set via ENV vars, flip `enabled: true` post-launch)
- [x] No hardcoded secrets or placeholder patterns in shipped code

### Still needed before final submission
- [ ] **Icon**: Upload final 1024×1024 app icon via Vibecode IMAGES tab, then reference in app.json
- [ ] **Splash screen**: Upload final splash image
- [ ] **Screenshots**: Capture 6.7-inch iPhone and iPad screenshots (min 3 per device)
- [ ] **AdMob App ID**: Add `ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX` to app.json under `plugins`
- [ ] **Sentry DSN**: Add `EXPO_PUBLIC_SENTRY_DSN` via ENV tab for production crash monitoring
- [ ] **Production AdMob unit IDs**: Add via ENV tab, then set `enabled: true` in `ads/index.ts`
- [ ] **App Store Connect**: Set Privacy Policy URL to `$BACKEND_URL/privacy`
- [ ] **App Store Connect**: Data Safety — declare: Work hours data (account-linked), no third-party sharing
- [ ] **Publish**: Use Vibecode "Publish" button (top-right) to submit EAS build
