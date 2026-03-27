# WorkClock — Production Handoff Document

Last updated: 2026-03-27

---

## 1. Services & Infrastructure

| Service | Role | Notes |
|---------|------|-------|
| Vibecode Hosting | App server + backend | Deploy via "Deploy" button in Vibecode |
| SQLite (dev.db) | Database (current) | **Must migrate to PostgreSQL before launch** |
| Resend (optional) | Transactional email | Set `RESEND_API_KEY` in ENV tab |
| Expo / EAS | Mobile app build | Publish via Vibecode "Share" button |

### Before Launch: Database Migration
The current database is SQLite (`backend/prisma/dev.db`). Before production:
1. Set up a PostgreSQL database (Supabase, Neon, Railway, etc.)
2. Change `backend/prisma/schema.prisma` → `provider = "postgresql"`
3. Set `DATABASE_URL` in ENV tab to the Postgres connection string
4. Run `bunx prisma migrate deploy`

---

## 2. Environment Variables

Set these in the **ENV tab** in Vibecode:

### Backend
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | YES | DB connection string |
| `JWT_SECRET` | YES | Secret for session tokens (min 32 chars, random) |
| `NODE_ENV` | YES | `development` or `production` |
| `PORT` | No | Backend port (default: 3000) |
| `RESEND_API_KEY` | No | Resend API key for emails. Without it, tokens are logged to console |
| `BACKEND_URL` | YES | Public URL of the backend (used in email links) |

### Mobile
| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_BACKEND_URL` | YES | Backend API URL (set automatically in Vibecode) |

---

## 3. Database Schema (8 tables)

### User
- `id`, `email` (unique), `username`, `passwordHash`
- `role`: `"USER"` | `"ADMIN"`
- `status`: `"ACTIVE"` | `"SUSPENDED"` | `"DISABLED"`
- `isEmailVerified`, `lastLoginAt`
- Relations: UserSession[], PasswordResetToken[], UserSettings?, WorkSession[]

### UserSession
- `id`, `userId` (FK→User), `token` (unique Bearer token)
- `expiresAt` (30 days), `platform`, `deviceName`, `lastSeenAt`, `isActive`

### PasswordResetToken
- `id`, `userId` (FK→User), `token` (32-byte hex)
- `type`: `"password_reset"` | `"email_verification"`
- `expiresAt` (1h for reset, 6h for verify), `usedAt`

### UserSettings (cloud-synced, per user)
- `id`, `userId` (FK→User, unique)
- `hourlyRate`, `currency`, `dailyGoalHours`, `weeklyGoalHours`
- `defaultBreakMinutes`, `showSalaryOnDashboard`, `themeMode`, `onboardingCompleted`

### WorkSession
- `id`, `deviceId` (secondary/legacy), `userId` (FK→User, optional)
- `date` (YYYY-MM-DD), `startTime`, `endTime`
- `grossMinutes`, `breakMinutes`, `netMinutes`, `totalPay`
- `notes`, `workplaceName`, `sessionType`, `status`
- Relations: BreakSession[]

### BreakSession
- `id`, `workSessionId` (FK→WorkSession, cascade delete)
- `startTime`, `endTime`, `durationMinutes`

### AppConfig
- `id`, `key` (unique), `value`, `description`
- Default keys: `tip_percentage`, `min_wage`, `vat_rate`, `app_name`, `support_email`

### Settings (LEGACY — device-based)
- `id`, `deviceId` (unique), full settings fields
- New users use `UserSettings` instead

---

## 4. API Routes

### Public (no auth)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset with token |
| POST | `/api/auth/verify-email` | Verify email |
| POST | `/api/auth/request-account-deletion` | Public deletion request (App Store requirement) |
| GET | `/health` | Health check |

### Authenticated (Bearer token required)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/change-password` | Change password |
| PUT | `/api/auth/profile` | Update profile |
| DELETE | `/api/auth/account` | Delete account (requires password) |
| GET/PUT | `/api/settings` | User settings (cloud-synced) |
| GET | `/api/sessions` | List sessions |
| GET | `/api/sessions/active` | Active session |
| POST | `/api/sessions` | Start work |
| GET/PUT/PATCH | `/api/sessions/:id` | Single session |
| DELETE | `/api/sessions/:id` | Delete session |
| POST | `/api/sessions/:id/breaks` | Start break |
| PUT | `/api/sessions/:id/breaks/:breakId` | End break |
| GET | `/api/stats` | Statistics |

### Admin (ADMIN role required)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/users` | List all users |
| GET/PUT | `/api/admin/users/:id` | User detail / update status/role |
| DELETE | `/api/admin/users/:id/sessions` | Force logout user |
| GET | `/api/admin/stats` | Platform stats |
| GET/PUT | `/api/admin/config` | App config (min wage, tax rates etc.) |

### Legacy (deprecated, kept for backward compat)
- `/api/sessions/:deviceId` — old device-based session routes
- `/api/settings/:deviceId` — old device-based settings
- `/api/stats/:deviceId` — old stats

---

## 5. Admin Access

### First-Time Setup
Only available in non-production OR when no admin exists:
```
POST /api/admin/setup
{ "email": "admin@...", "password": "...", "setupKey": "..." }
```
After first admin is created in production, this endpoint returns 403.

### Admin Capabilities
Via the mobile app (Settings → Admin):
- View all users, suspend/disable accounts
- Force-logout users
- Platform statistics
- App config management (min wage, tip rates, etc.)

---

## 6. Security

### Token Storage
- Native (iOS/Android): **expo-secure-store** (Keychain/Keystore)
- Web fallback: AsyncStorage
- Expiry: 30 days

### Auth Flow
1. Login → server creates `UserSession` with UUID token
2. Mobile stores token in SecureStore
3. All API calls: `Authorization: Bearer <token>`
4. Middleware validates token + expiry + isActive flag

### Rate Limiting
- Auth routes: 10 req/15min per IP
- Password reset: 5 req/hour per IP

### Deep Links (mobile scheme: `vibecode://`)
- Password reset: `vibecode://reset-password?token=XXX`
- Email verify: `vibecode://verify-email?token=XXX`

---

## 7. Tax Engine (Israeli Law 2026)

Files: `mobile/src/lib/utils/tax-calc.ts`, `overtime-calc.ts`

- Tax brackets: 2026 Israeli income tax (10%→50%)
- Includes Bituach Leumi + health insurance
- Overtime: hours 1-2 over 8h/day = 125%, beyond = 150%
- Weekly overtime: over 42h/week at 125%
- One-time additions: bonus, phone allowance, gift card, Sibos/Ten Bis

---

## 8. Account Deletion (App Store Compliance)

### From the app:
Settings → Delete Account → enter password → hard delete

### What is deleted (in order):
1. WorkSessions (cascades BreakSessions automatically)
2. PasswordResetTokens
3. UserSessions
4. UserSettings
5. User record

### Public deletion URL (for App Store listing):
`POST /api/auth/request-account-deletion` — accepts `{ email }`, returns instructions

---

## 9. Deploy Process

1. Click **Deploy** in Vibecode (top right)
2. Ensure all ENV variables are set
3. For DB migration: `bunx prisma migrate deploy` (PostgreSQL)
4. For mobile: Vibecode "Share" → "Submit to App Store"

---

## 10. Logs

### Backend logs
- Vibecode LOGS tab or `backend/server.log`
- Structured JSON events: `account_deleted`, `user_login`, `user_logout`, `password_reset`, `admin_role_change`

### Mobile logs
- Vibecode LOGS tab or `mobile/expo.log`

---

## 11. Ads

Ads are currently **disabled**. The partial implementation has been replaced with a no-op stub. To enable ads in the future, integrate AdMob or similar and restore `mobile/src/lib/ads/ad-manager.ts`.

---

## 12. Maintenance Checklist

### Weekly
- Review error logs for anomalies
- Check for login spike patterns (brute force)

### Monthly
- Verify `AppConfig → min_wage` matches current Israeli law
- Review suspended/disabled accounts

### Before each release
- Full QA checklist (auth, sessions, salary, RTL, dark mode)
- Test deep links (password reset, email verify) on device
- Test account deletion end-to-end

---

## 13. Remaining Before Launch

| Item | Status |
|------|--------|
| Migrate SQLite → PostgreSQL | PENDING — need to set up DB |
| Set `JWT_SECRET` (min 32 chars, random) | PENDING |
| Set `RESEND_API_KEY` for real emails | PENDING |
| Set `NODE_ENV=production` | PENDING |
| app.json: name, slug, bundleIdentifier | PENDING — configure at EAS build time |
| App Store assets (icon, screenshots) | PENDING |
| Privacy Policy URL | PENDING |
| Ads integration (if monetizing) | PENDING |
