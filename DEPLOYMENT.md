# WorkClock — Production Deployment Handoff

> Complete infrastructure guide. When you supply credentials, everything here should work without further code changes.

---

## 1. Environment Variables Required

### Backend (`/home/user/workspace/backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | ✅ | Server port (default: 3000) |
| `NODE_ENV` | ✅ | `production` in prod |
| `DATABASE_URL` | ✅ | Postgres/Supabase connection string (see §4) |
| `SETUP_SECRET` | ✅ | Secret header required for `/api/admin/setup` |
| `RESEND_API_KEY` | ✅ | Resend.com API key for transactional email |
| `BACKEND_URL` | ✅ | Public backend URL (e.g. `https://api.workclock.app`) |
| `FRONTEND_URL` | optional | Frontend URL for email links (e.g. `https://workclock.app`) |

### Mobile (`/home/user/workspace/mobile/.env`)

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | ✅ | Full backend URL (e.g. `https://api.workclock.app`) |

---

## 2. First-Time Bootstrap (Admin Account)

After deploying the backend for the first time:

```bash
curl -X POST https://api.workclock.app/api/admin/setup \
  -H "Content-Type: application/json" \
  -H "x-setup-secret: YOUR_SETUP_SECRET" \
  -d '{"email":"admin@workclock.app","password":"YourSecurePassword1!","username":"admin"}'
```

- Returns `token` and `user` with `role: "ADMIN"`
- This endpoint is **disabled** in production once any admin exists
- Store the token securely — use it to access the admin panel in the mobile app

---

## 3. Database Setup

### Current: SQLite (Development)
- File: `backend/prisma/dev.db`
- Schema: `backend/prisma/schema.prisma`
- Push schema: `cd backend && bunx prisma db push`

### Migration to Postgres / Supabase (Production)

1. **Get a Postgres connection string** from Supabase, Railway, Neon, or any Postgres host
2. **Update `backend/prisma/schema.prisma`** datasource:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. **Run initial migration:**
   ```bash
   cd backend
   DATABASE_URL="postgres://..." bunx prisma migrate deploy
   ```
4. **Bootstrap admin** (see §2)

### Tables / Models

| Model | Purpose |
|---|---|
| `User` | Accounts (email, passwordHash, role, status) |
| `UserSession` | Auth tokens with device info |
| `PasswordResetToken` | Reset + email verification tokens |
| `UserSettings` | Per-user settings (hourly rate, currency, etc.) |
| `WorkSession` | Work shifts with breaks |
| `BreakSession` | Individual breaks within a work session |
| `AppConfig` | Key-value system config (tax rates, etc.) |
| `AuditLog` | Security/admin action log |

---

## 4. Backend Deployment

### Option A: Railway / Render / Fly.io

1. Push repo to GitHub
2. Connect to Railway/Render
3. Set root directory: `backend`
4. Build command: `bun install && bunx prisma generate`
5. Start command: `bun start`
6. Set all env vars (§1)

### Option B: VPS / Docker

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY backend/ .
RUN bun install --frozen-lockfile
RUN bunx prisma generate
EXPOSE 3000
CMD ["bun", "start"]
```

### Health Check
```bash
curl https://api.workclock.app/api/health
# → { "status": "ok", "timestamp": "..." }
```

---

## 5. Mobile App Publishing

> Do NOT use EAS CLI or build commands in the Vibecode sandbox. Use the Vibecode "Publish" flow.

### App Store (iOS)
- Bundle ID: `com.workclock.app`
- Scheme: `workclock`
- Required: Apple Developer account ($99/year)
- Submit via Vibecode app → "Share" → "Submit to App Store"

### Google Play (Android)
- Package: `com.workclock.app`
- Required: Google Play Developer account ($25 one-time)
- Data Safety declaration: app collects Email, Name, Work/time data
- Account deletion: in-app ✅ + web endpoint at `/api/auth/request-account-deletion` ✅

---

## 6. AdMob Setup

When your AdMob account is ready:

1. Go to `/home/user/workspace/mobile/src/lib/ads/index.ts`
2. Set `enabled: true`
3. Set `testMode: false` in production
4. Replace placeholder `unitId` values with real AdMob unit IDs
5. Install native package: `bun add react-native-google-mobile-ads` (requires EAS build)

Ad placements already configured:
- `home_banner` — Banner on home screen
- `history_banner` — Banner on history screen
- `report_interstitial` — Interstitial on reports
- `simulation_rewarded` — Rewarded ad on salary simulation

---

## 7. Email (Transactional)

Using **Resend.com**:
1. Create account at resend.com
2. Add your domain (e.g. `workclock.app`)
3. Create API key → set as `RESEND_API_KEY`
4. Update sender in `backend/src/services/email.ts` from `noreply@workclock.app`

Emails sent:
- Welcome email on registration
- Password reset link
- Email verification link

---

## 8. Admin Panel

The mobile app includes a full admin panel accessible to `role: "ADMIN"` users.

**Access:** Log in with an admin account → app auto-redirects to admin panel.

**Features:**
- Dashboard: user count, active users, registrations chart
- Users list: search, view, block/unblock, change role, reset password, delete
- App config: edit system key-value configs (tax rates, min wage, etc.)
- Audit logs: all admin/auth actions with timestamps and IPs

**Admin API routes** (all require `Authorization: Bearer <token>` with ADMIN role):
- `GET /api/admin/users` — list users (pagination, search)
- `GET /api/admin/users/:id` — user detail
- `PUT /api/admin/users/:id` — update role/status
- `DELETE /api/admin/users/:id` — hard delete user
- `POST /api/admin/users/:id/reset-password` — generate reset token
- `DELETE /api/admin/users/:id/sessions` — revoke all sessions
- `GET /api/admin/stats` — system stats
- `GET /api/admin/config` — app config list
- `PUT /api/admin/config/:key` — update config value
- `GET /api/admin/audit-logs` — paginated audit log

---

## 9. Auth Flow Summary

| Flow | Endpoint |
|---|---|
| Register | `POST /api/auth/register` |
| Login | `POST /api/auth/login` |
| Logout | `POST /api/auth/logout` |
| Get current user | `GET /api/auth/me` |
| Forgot password | `POST /api/auth/forgot-password` |
| Reset password | `POST /api/auth/reset-password` |
| Change password | `POST /api/auth/change-password` |
| Update profile | `PUT /api/auth/profile` |
| Delete account | `DELETE /api/auth/account` |
| List devices | `GET /api/auth/sessions` |
| Revoke device | `DELETE /api/auth/sessions/:id` |
| App Store deletion | `POST /api/auth/request-account-deletion` |

All auth-required routes use `Authorization: Bearer <token>`.
Rate limiting: 20 req/15min on register/login, 5 req/15min on reset.

---

## 10. Security Checklist

- [x] Passwords hashed with bcrypt (cost factor 12)
- [x] Auth tokens are UUID, stored hashed in DB
- [x] Rate limiting on auth endpoints
- [x] SETUP_SECRET gate on admin bootstrap
- [x] Admin role checked server-side on every admin route
- [x] All sensitive actions written to AuditLog
- [x] Account deletion removes ALL user data (cascade)
- [x] `.env` not committed to git
- [x] No secrets in source code
- [x] Input validation with Zod on all routes
- [x] CORS configured with trusted origins only
- [ ] Set `SETUP_SECRET` before deploying
- [ ] Set `RESEND_API_KEY` for email flows
- [ ] Enable HTTPS on backend (handled by hosting provider)
- [ ] Set up log aggregation (Logtail, Papertrail, etc.)
- [ ] Set up crash reporting (Sentry)

---

## 11. Monitoring & Logging

The backend uses structured JSON logging via `src/lib/logger.ts`.

All log lines are JSON with `{ level, message, timestamp, data }`.

To connect Sentry in the future:
1. `bun add @sentry/bun`
2. Init in `src/index.ts` before routes
3. Add `Sentry.captureException(err)` in error handlers

---

## 12. QA Checklist (Manual Testing Before Release)

### Auth
- [ ] Register with email + password
- [ ] Register with Hebrew username
- [ ] Login with email
- [ ] Login with username
- [ ] Forgot password → receive email → reset → login with new password
- [ ] Change password from settings
- [ ] Logout on one device, still logged in on other
- [ ] Delete account → all data gone → redirected to login
- [ ] Suspended account shows correct error message

### Work Sessions
- [ ] Start work → active session shows on home
- [ ] End work → session appears in history
- [ ] Start break during active session
- [ ] End break → break recorded correctly
- [ ] Manual add session (past date)
- [ ] Edit existing session
- [ ] Delete session
- [ ] Sessions sync across two devices (same account)

### Salary & Stats
- [ ] Home screen shows correct week hours
- [ ] Home screen shows correct month hours
- [ ] Settings: change hourly rate → salary recalculates
- [ ] Reports page: monthly totals correct
- [ ] Simulation: changing inputs updates forecast
- [ ] Tax brackets page renders

### Admin
- [ ] Login as admin → redirected to admin panel
- [ ] Admin dashboard shows user count
- [ ] Admin: search users
- [ ] Admin: block/unblock user
- [ ] Admin: change user role
- [ ] Admin: delete user → user data gone
- [ ] Admin: audit log shows actions
- [ ] Admin: edit app config (min wage, etc.)
- [ ] Non-admin cannot access admin routes (403)

### Settings & Profile
- [ ] Settings sync from server after login
- [ ] Update hourly rate → saved to server
- [ ] Profile: update username
- [ ] Profile: delete account modal with password confirmation

### Store Readiness
- [ ] Privacy policy screen opens
- [ ] App name: "WorkClock"
- [ ] Bundle ID: `com.workclock.app`
- [ ] No broken deep links
- [ ] No hardcoded test credentials visible to users

---

## 13. Services You Need to Own

| Service | Purpose | Cost |
|---|---|---|
| GitHub | Source code | Free |
| Hosting (Railway/Fly/Render) | Backend server | $5-20/mo |
| Database (Supabase/Neon) | Postgres DB | Free-$25/mo |
| Domain (workclock.app) | Custom domain | ~$15/yr |
| Resend.com | Transactional email | Free up to 3k/mo |
| Apple Developer | iOS distribution | $99/yr |
| Google Play | Android distribution | $25 one-time |
| Google AdMob | In-app ads | Free (revenue share) |
| Sentry | Crash reporting | Free up to 5k errors/mo |

**Total minimum cost to launch:** ~$125 first year (domain + Apple + Postgres)

---

## 14. Architecture Summary

```
Mobile App (Expo RN)
    ↓ HTTPS Bearer token
Backend (Hono / Bun)
    ↓ Prisma ORM
Database (SQLite dev / Postgres prod)
```

**Key design decisions:**
- All business data owned by `userId`, not `deviceId`
- Single source of truth for settings: `UserSettings` table
- Sessions are JWT-free: random UUID tokens stored in `UserSession`
- Multi-device: each device gets its own token, revocable independently
- Admin RBAC: `User.role` checked server-side on every admin endpoint
- Audit log: every sensitive action recorded with actor, target, IP, timestamp
