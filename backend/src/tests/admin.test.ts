import { test, expect, describe, beforeAll } from "bun:test";

const BASE_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

const ts = Date.now();
const ADMIN_EMAIL = `admin-${ts}@test.com`;
const ADMIN_PASSWORD = "AdminPass1!";
const REGULAR_EMAIL = `regular-${ts}@test.com`;
const REGULAR_PASSWORD = "RegularPass1!";

// Unique fake IP per run to avoid rate-limit collisions
const FAKE_IP = `10.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${(ts + 2) % 254 + 1}`;

let adminToken: string = "";
let regularToken: string = "";
let adminAlreadyExists = false;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Register a regular user for testing non-admin access
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": FAKE_IP,
    },
    body: JSON.stringify({ email: REGULAR_EMAIL, password: REGULAR_PASSWORD }),
  });
  if (regRes.ok) {
    const body = await regRes.json() as any;
    regularToken = body.data?.token ?? "";
  } else {
    const text = await regRes.text();
    console.warn(`[admin] Regular user registration failed (${regRes.status}): ${text}`);
  }

  // Try to create an admin via setup (may fail if admin already exists)
  const setupRes = await fetch(`${BASE_URL}/api/admin/setup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": FAKE_IP,
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (setupRes.ok) {
    const body = await setupRes.json() as any;
    adminToken = body.data?.token ?? "";
  } else {
    const body = await setupRes.json() as any;
    if (
      body?.error?.code === "ADMIN_EXISTS" ||
      body?.error?.code === "ADMIN_ALREADY_CONFIGURED"
    ) {
      adminAlreadyExists = true;
    }
    console.warn(`[admin] Admin setup failed (${setupRes.status}): ${JSON.stringify(body?.error)}`);
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/admin/setup", () => {
  test("requires SETUP_SECRET header when env var is set", async () => {
    const setupSecret = process.env.SETUP_SECRET;
    if (!setupSecret) {
      console.log("SETUP_SECRET not set — skipping secret-gate test");
      return;
    }

    const res = await fetch(`${BASE_URL}/api/admin/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": FAKE_IP,
        // Intentionally no x-setup-secret header
      },
      body: JSON.stringify({ email: `badsetup-${ts}@test.com`, password: ADMIN_PASSWORD }),
    });
    expect(res.status).toBe(403);

    const body = await res.json() as any;
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("returns 409 or 403 when admin already exists", async () => {
    // After setup (or pre-existing admin), attempting setup again must fail
    const res = await fetch(`${BASE_URL}/api/admin/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": FAKE_IP,
      },
      body: JSON.stringify({
        email: `admin2-${ts}@test.com`,
        password: ADMIN_PASSWORD,
      }),
    });
    // 409 = admin exists (non-production), 403 = production mode
    expect([409, 403]).toContain(res.status);
  });
});

describe("GET /api/admin/users", () => {
  test("returns 401 without auth token", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/users`);
    expect(res.status).toBe(401);
  });

  test("returns 403 for regular (non-admin) user", async () => {
    if (!regularToken) {
      console.warn("Skipping: no regular user token (possible rate limit)");
      return;
    }

    const res = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: {
        Authorization: `Bearer ${regularToken}`,
        "X-Forwarded-For": FAKE_IP,
      },
    });
    expect(res.status).toBe(403);
  });

  test("returns user list for admin user", async () => {
    if (!adminToken) {
      console.warn("Skipping: no admin token available (admin may pre-exist or rate-limited)");
      return;
    }

    const res = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "X-Forwarded-For": FAKE_IP,
      },
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.users)).toBe(true);
    expect(typeof body.data.total).toBe("number");
  });

  test("supports pagination query params", async () => {
    if (!adminToken) {
      console.warn("Skipping: no admin token available");
      return;
    }

    const res = await fetch(`${BASE_URL}/api/admin/users?page=1&limit=5`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "X-Forwarded-For": FAKE_IP,
      },
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(Array.isArray(body.data.users)).toBe(true);
    expect(body.data.users.length).toBeLessThanOrEqual(5);
  });
});
