# Production Handoff Guide — WorkClock

Last updated: 2026-03-28

---

## Quick Start

### Required Environment Variables

**Backend** (`backend/.env`):
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| PORT | No (default: 3000) | Server port | `3000` |
| NODE_ENV | Yes (prod) | Environment | `production` |
| BACKEND_URL | Yes | Full backend URL (for CORS, auth) | `https://api.yourapp.com` |
| RESEND_API_KEY | Optional | Resend.com API key for emails | `re_xxxxx` |
| SETUP_SECRET | Required (prod) | Protects /api/admin/setup | `a-long-random-string` |
| LOG_LEVEL | Optional | Log verbosity | `info` |
| SENTRY_DSN | Optional | Sentry crash reporting URL | `https://xxx@sentry.io/xxx` |

**Mobile** (`mobile/.env`):
| Variable | Required | Description |
|----------|----------|-------------|
| EXPO_PUBLIC_BACKEND_URL | Yes | Backend URL | `https://api.yourapp.com` |
| EXPO_PUBLIC_SENTRY_DSN | Optional | Sentry for mobile crashes | |
| EXPO_PUBLIC_ADMOB_BANNER_ID | Optional | AdMob banner unit ID | |
| EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID | Optional | AdMob interstitial unit ID | |

### First Deployment Steps

1. **Set up database** (choose one):
   - SQLite (dev only): Already configured, no changes needed
   - PostgreSQL (production): Change `schema.prisma` datasource provider to `postgresql`, update `DATABASE_URL`

2. **Configure environment** (see table above)

3. **Initialize database**:
   ```bash
   cd backend
   bunx prisma migrate deploy  # production migrations
   # OR: bunx prisma db push   # dev/testing
   ```

4. **Create first admin**:
   ```bash
   # After setting SETUP_SECRET in env:
   curl -X POST $BACKEND_URL/api/admin/setup \
     -H "Content-Type: application/json" \
     -H "X-Setup-Secret: your-SETUP_SECRET-value" \
     -d '{"email":"admin@yourapp.com","password":"StrongPassword1!"}'
   ```

5. **Verify health**:
   ```bash
   curl $BACKEND_URL/health  # → {"status":"ok"}
   ```

---

## Services & Infrastructure

| Service | Role | Notes |
|---------|------|-------|
| Vibecode Hosting | App server + backend | Deploy via "Deploy" button in Vibecode |
| SQLite (dev.db) | Database (current) | **Must migrate to PostgreSQL before launch** |
| Resend (optional) | Transactional email | Set `RESEND_API_KEY` in ENV tab |
| Expo / EAS | Mobile app build | Publish via Vibecode "Share" button |

---

## How to Connect Production PostgreSQL

1. Install PostgreSQL adapter: `cd backend && bun add pg @prisma/adapter-pg`
2. Update `schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Add `DATABASE_URL=postgresql://user:password@host:5432/dbname` to backend `.env`
4. Run: `bunx prisma migrate deploy`

---

## How to Connect Monitoring (Sentry)

**Backend:**
1. Install: `cd backend && bun add @sentry/node`
2. Add to `backend/src/index.ts` (before route mounts):
   ```typescript
   import * as Sentry from "@sentry/node";
   if (env.SENTRY_DSN) {
     Sentry.init({ dsn: env.SENTRY_DSN });
     setErrorReporter((err, ctx) => Sentry.captureException(err, { extra: ctx }));
   }
   ```
3. Set `SENTRY_DSN` in backend `.env`

**Mobile:**
1. `EXPO_PUBLIC_SENTRY_DSN` is already read by `mobile/src/lib/crash-reporter.ts`
2. Set the variable, rebuild app

---

## How to Connect AdMob

1. The mobile app has ad infrastructure ready in:
   - `mobile/src/components/ads/AdBanner.tsx`
   - `mobile/src/components/ads/useInterstitialAd.ts`
   - `mobile/src/lib/ads-config.ts`
2. To activate real ads:
   - Install: `npx expo install react-native-google-mobile-ads`
   - Add your AdMob App ID to `mobile/app.json`
   - Set `EXPO_PUBLIC_ADMOB_BANNER_ID` and other ad unit IDs
   - Update the components to use the real AdMob SDK
3. Note: Native ad packages require an EAS Build (not Expo Go)

---

## How to Manage Users (Admin)

**Via Admin Panel in app:**
- Login as admin → admin tab appears automatically
- Manage users: promote, suspend, delete
- View audit logs
- Edit app config (minimum wage, support email, etc.)

**Via API (cURL):**
```bash
# List users
curl $BACKEND_URL/api/admin/users -H "Authorization: Bearer $ADMIN_TOKEN"

# Suspend user
curl -X PATCH $BACKEND_URL/api/admin/users/USER_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"SUSPENDED"}'
```

---

## How to Rotate Secrets

1. Generate new SETUP_SECRET: `openssl rand -hex 32`
2. Update in deployment environment
3. Restart backend
4. The old secret is immediately invalid

For session tokens: all existing tokens use SHA-256 hashing automatically. To force all users to re-login, delete all rows from `UserSession` table.

---

## How to Review Logs

**Backend logs** are structured JSON (one object per line):
```bash
# Filter errors only
cat server.log | grep '"level":"error"'

# Filter by user
cat server.log | grep '"userId":"USER_ID"'

# Filter auth events
cat server.log | grep '"action":"LOGIN"'
```

**Correlate requests** using `x-request-id` header in responses — each request has a unique ID traceable across logs.

---

## Database Schema (8 tables)

### User
- `id`, `email` (unique), `username`, `passwordHash`
- `role`: `"USER"` | `"ADMIN"`
- `status`: `"ACTIVE"` | `"SUSPENDED"` | `"DISABLED"`
- `isEmailVerified`, `lastLoginAt`
- Relations: UserSession[], PasswordResetToken[], UserSettings?, WorkSession[]

### UserSession
- `id`, `userId` (FK→User), `token` (unique Bearer token, stored as SHA-256 hash)
- `expiresAt` (30 days), `platform`, `deviceName`, `lastSeenAt`, `isActive`
- Indexes: `(userId, expiresAt)`, `(userId, isActive)` for efficient cleanup and lookup

### PasswordResetToken
- `id`, `userId` (FK→User), `token` (32-byte hex)
- `type`: `"password_reset"` | `"email_verification"`
- `expiresAt` (1h for reset, 6h for verify), `usedAt`
- Indexes: `(userId, type)`, `(expiresAt)` for efficient token queries

### UserSettings (cloud-synced, per user)
- `id`, `userId` (FK→User, unique)
- `hourlyRate`, `currency`, `dailyGoalHours`, `weeklyGoalHours`
- `defaultBreakMinutes`, `showSalaryOnDashboard`, `themeMode`, `onboardingCompleted`

### WorkSession
- `id`, `userId` (FK→User)
- `date` (YYYY-MM-DD), `startTime`, `endTime`
- `grossMinutes`, `breakMinutes`, `netMinutes`, `totalPay`
- `notes`, `workplaceName`, `sessionType`, `status`
- Relations: BreakSession[]
- Indexes: `(userId, date)`, `(userId, status)`

### BreakSession
- `id`, `workSessionId` (FK→WorkSession, cascade delete)
- `startTime`, `endTime`, `durationMinutes`
- Index: `(workSessionId)`

### AppConfig
- `id`, `key` (unique), `value`, `description`
- Default keys: `min_wage`, `app_name`, `support_email`

### AuditLog
- `id`, `userId?`, `action`, `resource`, `details?`, `ip?`, `createdAt`
- Indexes: `(userId)`, `(createdAt)`, `(action)`, `(userId, createdAt)` for filtered queries

---

## API Routes

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
| GET | `/api/admin/audit-logs` | View audit log |

---

## Tax Engine (Israeli Law 2026)

Files: `mobile/src/lib/utils/tax-calc.ts`, `mobile/src/lib/utils/overtime-calc.ts`

- Tax brackets: 2026 Israeli income tax (10% → 50%)
- Credit point value: 242 NIS/month
- Includes Bituach Leumi + health insurance
- NI ceiling: 49,030 NIS/month; low tier ceiling: 7,420 NIS/month
- Overtime: hours 1-2 over 8h/day = 125%, beyond = 150%
- Weekly overtime: over 42h/week at 125%
- One-time additions: bonus, phone allowance, gift card, Sibos/Ten Bis
- Car benefit (שווי שימוש): increases income tax base but not NI base

Automated tests: `backend/src/tests/salary-engine.test.ts`

Run tests: `cd backend && bun test src/tests/salary-engine.test.ts`

---

## Account Deletion (App Store Compliance)

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

## App Store Submission Checklist

**iOS (App Store Connect):**
- [ ] App Privacy Report filled in (see Data Collection section below)
- [ ] Account deletion URL set to in-app flow (Settings → Delete Account)
- [ ] Privacy Policy URL set to: `$BACKEND_URL/api/legal/privacy`
- [ ] Screenshot sizes: 6.9", 6.5", 5.5" (plus iPad if needed)

**Data Collection Declaration (App Store / Google Play):**
| Data Type | Collected | Used For | Linked to User |
|-----------|-----------|----------|----------------|
| Email address | Yes | Account, password reset | Yes |
| Username | Optional | Account | Yes |
| Work session times | Yes | Core app function | Yes |
| Hourly rate / salary | Yes (synced to server) | Tax calculations | Yes |
| IP address | Yes (logs only) | Security/rate limiting | No |
| Crash data | Optional (Sentry if configured) | Bug fixing | No |
| Ad interactions | Future (AdMob when activated) | Revenue | No |

**Google Play Data Safety:**
- Shares no data with third parties (unless AdMob activated)
- Data encrypted in transit (HTTPS)
- User can delete account from within app

---

## Security Notes

- **Session tokens**: Stored as SHA-256 hashes in database. A DB breach does not expose usable tokens.
- **Passwords**: bcrypt hashed with cost factor 12. Never stored or logged in plain text.
- **Rate limiting**: 10 auth requests per 15 minutes per IP. 5 password reset requests per hour.
- **Admin setup**: Protected by SETUP_SECRET header. Only works when no admin exists OR secret matches.
- **Audit logs**: All admin actions, auth events, and account deletions are logged with timestamp, IP, and user ID.
- **CORS**: Echoes specific origin header; never uses wildcard `*` (required for `credentials: include`).

---

## Deploy Process

1. Click **Deploy** in Vibecode (top right)
2. Ensure all ENV variables are set
3. For DB migration: `bunx prisma migrate deploy` (PostgreSQL)
4. For mobile: Vibecode "Share" → "Submit to App Store"

---

## Maintenance Checklist

### Weekly
- Review error logs for anomalies
- Check for login spike patterns (brute force)

### Monthly
- Verify `AppConfig → min_wage` matches current Israeli law
- Review suspended/disabled accounts
- Check for expired but not-cleaned-up UserSession rows

### Before each release
- Full QA checklist (`PRODUCTION_QA_CHECKLIST.md`)
- Run salary engine tests: `bun test src/tests/salary-engine.test.ts`
- Test deep links (password reset, email verify) on device
- Test account deletion end-to-end
- Run `bunx tsc --noEmit` in backend — zero errors required

---

## Remaining Before Launch

| Item | Status |
|------|--------|
| Migrate SQLite → PostgreSQL | PENDING — need to set up DB |
| Set `RESEND_API_KEY` for real emails | PENDING |
| Set `NODE_ENV=production` | PENDING |
| Set `SETUP_SECRET` (min 32 chars, random) | PENDING |
| app.json: name, slug, bundleIdentifier | PENDING — configure at EAS build time |
| App Store assets (icon, screenshots) | PENDING |
| Privacy Policy URL | PENDING |
| Ads integration (if monetizing) | PENDING |
