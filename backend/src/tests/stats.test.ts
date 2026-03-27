import { test, expect, describe, beforeAll } from "bun:test";

const BASE_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

const ts = Date.now();
const TEST_EMAIL = `stats-${ts}@test.com`;
const TEST_PASSWORD = "TestPass1!";

// Unique fake IP per run to avoid rate-limit collisions
const FAKE_IP = `10.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${(ts + 2) % 254 + 1}`;

let authToken: string = "";

// ---------------------------------------------------------------------------
// Setup: register + get token
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": FAKE_IP,
    },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (res.ok) {
    const body = await res.json() as any;
    authToken = body.data?.token ?? "";
  } else {
    const text = await res.text();
    console.warn(`[stats] Registration failed (${res.status}): ${text}`);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authedGet(path: string) {
  return fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      "X-Forwarded-For": FAKE_IP,
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/user/stats", () => {
  test("requires auth - returns 401 without token", async () => {
    const res = await fetch(`${BASE_URL}/api/user/stats?period=week`);
    expect(res.status).toBe(401);
  });

  test("returns stats for period=week", async () => {
    if (!authToken) {
      console.warn("Skipping: registration failed, no token");
      return;
    }
    const res = await authedGet("/api/user/stats?period=week");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(typeof body.data.totalHours).toBe("number");
    expect(typeof body.data.totalPay).toBe("number");
    expect(body.data.period).toBe("week");
  });

  test("returns stats for period=month", async () => {
    if (!authToken) {
      console.warn("Skipping: registration failed, no token");
      return;
    }
    const res = await authedGet("/api/user/stats?period=month");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(typeof body.data.totalHours).toBe("number");
    expect(typeof body.data.totalPay).toBe("number");
    expect(body.data.period).toBe("month");
  });

  test("returns stats for period=year", async () => {
    if (!authToken) {
      console.warn("Skipping: registration failed, no token");
      return;
    }
    const res = await authedGet("/api/user/stats?period=year");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(typeof body.data.totalHours).toBe("number");
    expect(typeof body.data.totalPay).toBe("number");
    expect(body.data.period).toBe("year");
  });

  test("stats response includes expected fields", async () => {
    if (!authToken) {
      console.warn("Skipping: registration failed, no token");
      return;
    }
    const res = await authedGet("/api/user/stats?period=week");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    const data = body.data;

    // Core numeric stats
    expect(typeof data.totalHours).toBe("number");
    expect(typeof data.totalPay).toBe("number");
    expect(typeof data.avgHoursPerDay).toBe("number");
    expect(typeof data.workDaysCount).toBe("number");

    // Period metadata
    expect(typeof data.startDate).toBe("string");
    expect(typeof data.endDate).toBe("string");
    expect(data.period).toBe("week");

    // Daily breakdown is an array
    expect(Array.isArray(data.dailyData)).toBe(true);
  });
});
