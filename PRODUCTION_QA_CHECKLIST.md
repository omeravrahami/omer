# Production QA Checklist — WorkClock

## Pre-Submission Checks

### Authentication Flows
- [ ] Register with valid email/password → success + redirects to app
- [ ] Register with duplicate email → shows Hebrew error
- [ ] Register with weak password (< 8 chars, no digit) → validation error
- [ ] Login with correct credentials → success
- [ ] Login with wrong password → Hebrew error (not exposing which field is wrong)
- [ ] Login with non-existent email → same error message as wrong password (no enum)
- [ ] Forgot password → email sent (or token shown in dev mode)
- [ ] Password reset with valid token → success, redirected to login
- [ ] Password reset with expired token → error message
- [ ] Password reset with used token → error message
- [ ] Change password (logged in) → success
- [ ] Change password with wrong current password → error
- [ ] Email verification flow → verified badge visible
- [ ] Logout → token cleared, redirects to auth screen
- [ ] Session persistence after app restart
- [ ] Multiple sessions: login on two "devices" → both appear in sessions list
- [ ] Revoke a session → that session invalidated

### Account Management
- [ ] Delete account with wrong password → error
- [ ] Delete account with correct password → all data deleted, logout
- [ ] After deletion: login with same credentials → fails (account gone)
- [ ] Account deletion page accessible via web link (App Store compliance)

### Work Session Flows
- [ ] Clock in → active session shows in home screen
- [ ] Active session persists across app restart
- [ ] Cannot start second session while one is active
- [ ] Start break during session → break timer shown
- [ ] End break → resumes work timer
- [ ] Clock out → session saved to history
- [ ] Manual session creation (add-edit screen)
- [ ] Edit completed session → changes saved
- [ ] Delete session → removed from history
- [ ] Session with notes → notes displayed correctly
- [ ] Sick day session type → appears correctly in history
- [ ] Vacation session type → appears correctly

### Salary & Tax Calculations
- [ ] Home screen shows correct gross/net for current month
- [ ] Hours with hourly rate → correct total
- [ ] Tax breakdown card shows accurate percentages
- [ ] Insights cards match values shown in reports
- [ ] Dashboard values match history list values
- [ ] Reports screen totals match sum of sessions
- [ ] Tax brackets screen shows correct 2026 rates
- [ ] Simulation screen: extra hours → correct net impact
- [ ] Car benefit component → increases tax correctly
- [ ] Bonus component → added to taxable gross
- [ ] Zero hours month → shows zero everywhere, no NaN
- [ ] Partial month → prorated correctly

### Settings
- [ ] Change hourly rate → reflected immediately in calculations
- [ ] Change daily goal → goal bar updates
- [ ] Change weekly goal → insights update
- [ ] Dark/light mode toggle
- [ ] Settings persist across app restart
- [ ] Settings sync to cloud (check API)

### Admin Panel
- [ ] Admin login works
- [ ] Non-admin cannot access /admin/* routes
- [ ] User list loads
- [ ] Promote user to admin → works
- [ ] Suspend user → user cannot login
- [ ] Delete user (admin) → user removed
- [ ] Audit logs show recent events
- [ ] System health shows green status
- [ ] App config editable
- [ ] Admin cannot revoke their own admin role easily

### UI/UX
- [ ] RTL layout throughout (all Hebrew text right-aligned)
- [ ] All screens keyboard-safe (input not hidden by keyboard)
- [ ] Dark mode: no white flashers or contrast issues
- [ ] Loading states visible on all async operations
- [ ] Empty states shown when no data (new user, no sessions)
- [ ] Error toasts disappear after timeout
- [ ] Money character animation works (idle/working/break/done)
- [ ] Insights cards horizontally scrollable
- [ ] History grouped by month correctly
- [ ] Long session notes wrap correctly

### Network & Error States
- [ ] Offline: app shows appropriate message, doesn't crash
- [ ] Slow network: loading indicators shown
- [ ] Server error (500): user sees friendly Hebrew message
- [ ] Auth expired (401): user redirected to login
- [ ] Rate limited (429): appropriate wait message shown

### Platform-Specific
- [ ] iOS: Safe area insets correct (notch, home bar)
- [ ] Android: Back button behavior correct
- [ ] iPhone SE (small screen): no overflow or clipping
- [ ] iPhone 15 Pro Max (large screen): content not too spread out
- [ ] Tablet: reasonable layout (not stretched)

### Accessibility
- [ ] All interactive elements have meaningful labels
- [ ] VoiceOver/TalkBack: main flows navigable
- [ ] Minimum touch target size (44px) on all buttons
- [ ] Text not too small on small screens

### Performance
- [ ] App cold start < 3 seconds
- [ ] Navigation between tabs < 300ms
- [ ] History list scrolls smoothly (no jank with 100+ sessions)
- [ ] Reports screen loads in < 2 seconds
- [ ] No memory growth after extended use

### App Store Readiness
- [ ] Privacy Policy page loads correctly
- [ ] Terms of Service page loads correctly
- [ ] Account deletion flow works end-to-end
- [ ] App icon looks correct on iOS/Android
- [ ] Splash screen shows correctly
- [ ] Bundle ID matches app.json
- [ ] No test UI visible in production build

### Security
- [ ] Bearer token not visible in logs or console
- [ ] Password never logged
- [ ] Email not logged after account deletion
- [ ] /api/admin/* returns 403 for regular users
- [ ] Rate limiting works (10 auth attempts per 15min)
- [ ] SQL injection attempts return 400, not 500
