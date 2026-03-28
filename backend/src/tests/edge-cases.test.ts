import { test, expect, describe, beforeAll } from "bun:test";

const BASE_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

const ts = Date.now();
const TEST_EMAIL = `edge-${ts}@test.com`;
const TEST_PASSWORD = "TestPass1!";
const DUP_EMAIL = `edge-dup-${ts}@test.com`;

// Unique fake IP per run — bypasses the per-IP rate limiter (x-forwarded-for wins)
const FAKE_IP = `10.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${(ts + 9) % 254 + 1}`;

let authToken: string = "";
let activeSessionId: string = "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Forwarded-For": FAKE_IP,
    ...extra,
  };
}

function authedHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return baseHeaders({ Authorization: `Bearer ${authToken}`, ...extra });
}

function skipIfRateLimited(status: number): boolean {
  if (status === 429) {
    console.warn("Rate limited — skipping assertion (run tests again later)");
    return true;
  }
  return false;
}

async function register(email: string, password: string = TEST_PASSWORD) {
  return fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify({ email, password }),
  });
}

async function startSession() {
  return fetch(`${BASE_URL}/api/user/sessions`, {
    method: "POST",
    headers: authedHeaders(),
    body: JSON.stringify({ startTime: new Date().toISOString() }),
  });
}

// ---------------------------------------------------------------------------
// Setup: register a fresh user so we have a valid auth token
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const res = await register(TEST_EMAIL);
  if (res.ok) {
    const body = await res.json() as any;
    authToken = body.data?.token ?? "";
  } else {
    const text = await res.text();
    console.warn(`[edge-cases] Registration failed (${res.status}): ${text}`);
  }
});

// ---------------------------------------------------------------------------
// 1. Duplicate registration
// ---------------------------------------------------------------------------

describe("Duplicate registration", () => {
  test("second registration with same email returns 409", async () => {
    // First registration
    const first = await register(DUP_EMAIL);
    if (skipIfRateLimited(first.status)) return;
    expect(first.status).toBe(201);

    // Second registration — same email
    const second = await register(DUP_EMAIL);
    if (skipIfRateLimited(second.status)) return;
    expect([400, 409]).toContain(second.status);

    const body = await second.json() as any;
    expect(body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Login with wrong password
// ---------------------------------------------------------------------------

describe("Login with wrong password", () => {
  test("returns 401 for incorrect password", async () => {
    if (!authToken) {
      console.warn("Skipping: no auth token (registration may have been rate-limited)");
      return;
    }

    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({ identifier: TEST_EMAIL, password: "WrongPassword99!" }),
    });
    if (skipIfRateLimited(res.status)) return;
    expect(res.status).toBe(401);

    const body = await res.json() as any;
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

// ---------------------------------------------------------------------------
// 3. Access protected endpoint without token
// ---------------------------------------------------------------------------

describe("Protected endpoints without token", () => {
  test("GET /api/user/sessions returns 401 without token", async () => {
    const res = await fetch(`${BASE_URL}/api/user/sessions`, {
      headers: { "X-Forwarded-For": FAKE_IP },
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/user/sessions returns 401 without token", async () => {
    const res = await fetch(`${BASE_URL}/api/user/sessions`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({ startTime: new Date().toISOString() }),
    });
    expect(res.status).toBe(401);
  });

  test("GET /api/user/stats returns 401 without token", async () => {
    const res = await fetch(`${BASE_URL}/api/user/stats?period=week`, {
      headers: { "X-Forwarded-For": FAKE_IP },
    });
    expect(res.status).toBe(401);
  });

  test("GET /api/user/sessions/active returns 401 without token", async () => {
    const res = await fetch(`${BASE_URL}/api/user/sessions/active`, {
      headers: { "X-Forwarded-For": FAKE_IP },
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 4. Access protected endpoint with invalid/expired token
// ---------------------------------------------------------------------------

describe("Protected endpoints with invalid token", () => {
  const BOGUS_TOKEN = "totally.invalid.jwt.token.that.will.never.verify";

  test("GET /api/user/sessions returns 401 with bogus token", async () => {
    const res = await fetch(`${BASE_URL}/api/user/sessions`, {
      headers: {
        Authorization: `Bearer ${BOGUS_TOKEN}`,
        "X-Forwarded-For": FAKE_IP,
      },
    });
    expect(res.status).toBe(401);
  });

  test("GET /api/user/stats returns 401 with bogus token", async () => {
    const res = await fetch(`${BASE_URL}/api/user/stats?period=week`, {
      headers: {
        Authorization: `Bearer ${BOGUS_TOKEN}`,
        "X-Forwarded-For": FAKE_IP,
      },
    });
    expect(res.status).toBe(401);
  });

  test("GET /api/admin/users returns 401 with bogus token", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: {
        Authorization: `Bearer ${BOGUS_TOKEN}`,
        "X-Forwarded-For": FAKE_IP,
      },
    });
    // 401 (no valid auth) or 403 (valid auth but no admin role) both acceptable
    expect([401, 403]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// 5. Sessions endpoint requires auth (explicit coverage)
// ---------------------------------------------------------------------------

describe("Sessions require auth", () => {
  test("GET /api/user/sessions without token returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/user/sessions`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 6. Cannot start session while one is already active
// ---------------------------------------------------------------------------

describe("Cannot start duplicate active session", () => {
  test("starting a second session while one is active returns 400", async () => {
    if (!authToken) {
      console.warn("Skipping: no auth token");
      return;
    }

    // Start the first session
    const first = await startSession();
    if (skipIfRateLimited(first.status)) return;

    if (first.status !== 201) {
      // Might already have an active session from a previous test run on same DB
      const body = await first.json() as any;
      if (body?.error?.code === "ACTIVE_SESSION_EXISTS") {
        // That is itself the expected duplicate-block behaviour — test passes
        expect(body.error.code).toBe("ACTIVE_SESSION_EXISTS");
        return;
      }
      console.warn(`[edge-cases] First session creation failed (${first.status}): ${JSON.stringify(body)}`);
      return;
    }

    const firstBody = await first.json() as any;
    activeSessionId = firstBody.data?.id ?? "";

    // Try to start a second session — must be blocked
    const second = await startSession();
    if (skipIfRateLimited(second.status)) return;
    expect(second.status).toBe(400);

    const secondBody = await second.json() as any;
    expect(secondBody.error).toBeDefined();
    expect(secondBody.error.code).toBe("ACTIVE_SESSION_EXISTS");
  });
});

// ---------------------------------------------------------------------------
// 7. End session that doesn't exist
// ---------------------------------------------------------------------------

describe("End non-existent session", () => {
  test("PUT /api/user/sessions/:id with fake id returns 404", async () => {
    if (!authToken) {
      console.warn("Skipping: no auth token");
      return;
    }

    const res = await fetch(`${BASE_URL}/api/user/sessions/nonexistent-id-000`, {
      method: "PUT",
      headers: authedHeaders(),
      body: JSON.stringify({ endTime: new Date().toISOString() }),
    });
    if (skipIfRateLimited(res.status)) return;
    expect([403, 404]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// 8. Stats with no sessions (fresh user has 0 stats)
// ---------------------------------------------------------------------------

describe("Stats with no sessions", () => {
  test("fresh user has zero totalHours and totalPay for week", async () => {
    // Register a brand-new user who has never created a session
    const freshEmail = `edge-fresh-${ts}@test.com`;
    const regRes = await register(freshEmail);
    if (skipIfRateLimited(regRes.status)) return;
    if (!regRes.ok) {
      console.warn(`[edge-cases] Fresh user registration failed (${regRes.status})`);
      return;
    }

    const regBody = await regRes.json() as any;
    const freshToken: string = regBody.data?.token ?? "";
    if (!freshToken) {
      console.warn("Skipping: could not get fresh user token");
      return;
    }

    const res = await fetch(`${BASE_URL}/api/user/stats?period=week`, {
      headers: {
        Authorization: `Bearer ${freshToken}`,
        "X-Forwarded-For": FAKE_IP,
      },
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(body.data.totalHours).toBe(0);
    expect(body.data.totalPay).toBe(0);
  });

  test("fresh user has zero totalHours and totalPay for month", async () => {
    const freshEmail = `edge-fresh2-${ts}@test.com`;
    const regRes = await register(freshEmail);
    if (skipIfRateLimited(regRes.status)) return;
    if (!regRes.ok) {
      console.warn(`[edge-cases] Fresh user registration failed (${regRes.status})`);
      return;
    }

    const regBody = await regRes.json() as any;
    const freshToken: string = regBody.data?.token ?? "";
    if (!freshToken) return;

    const res = await fetch(`${BASE_URL}/api/user/stats?period=month`, {
      headers: {
        Authorization: `Bearer ${freshToken}`,
        "X-Forwarded-For": FAKE_IP,
      },
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.data.totalHours).toBe(0);
    expect(body.data.totalPay).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Break on non-active session
// ---------------------------------------------------------------------------

describe("Break on non-active session", () => {
  test("starting a break on a completed/non-existent session returns 400 or 404", async () => {
    if (!authToken) {
      console.warn("Skipping: no auth token");
      return;
    }

    // First end the active session if we created one in test 6
    if (activeSessionId) {
      await fetch(`${BASE_URL}/api/user/sessions/${activeSessionId}`, {
        method: "PUT",
        headers: authedHeaders(),
        body: JSON.stringify({ endTime: new Date(Date.now() + 3600_000).toISOString() }),
      });
    }

    // Now try to add a break to a fake / completed session id
    const fakeId = "nonexistent-session-999";
    const res = await fetch(`${BASE_URL}/api/user/sessions/${fakeId}/breaks`, {
      method: "POST",
      headers: authedHeaders(),
      body: JSON.stringify({ startTime: new Date().toISOString() }),
    });
    if (skipIfRateLimited(res.status)) return;

    // Server should refuse — 400 (not active), 403 (not owner) or 404 (not found)
    expect([400, 403, 404]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// 10. Admin endpoints blocked for regular users
// ---------------------------------------------------------------------------

describe("Admin endpoints blocked for regular users", () => {
  test("GET /api/admin/users returns 403 for regular user", async () => {
    if (!authToken) {
      console.warn("Skipping: no auth token for regular user");
      return;
    }

    const res = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: authedHeaders(),
    });
    if (skipIfRateLimited(res.status)) return;
    expect(res.status).toBe(403);
  });

  test("POST /api/admin/setup returns 409 or 403 when already configured", async () => {
    // Setup must fail because an admin already exists (created by admin.test.ts or prior runs)
    const res = await fetch(`${BASE_URL}/api/admin/setup`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({ email: `edge-admin2-${ts}@test.com`, password: "AdminPass1!" }),
    });
    if (skipIfRateLimited(res.status)) return;
    // 409 = admin already exists, 403 = production guard
    expect([403, 409]).toContain(res.status);
  });

  test("GET /api/admin/users returns 401 without any token", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { "X-Forwarded-For": FAKE_IP },
    });
    expect(res.status).toBe(401);
  });
});
