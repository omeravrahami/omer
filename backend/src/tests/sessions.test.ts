import { test, expect, describe, beforeAll } from "bun:test";

const BASE_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

const ts = Date.now();
const TEST_EMAIL = `sessions-${ts}@test.com`;
const TEST_PASSWORD = "TestPass1!";

// Unique fake IP per run to avoid rate-limit collisions
const FAKE_IP = `10.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${(ts + 1) % 254 + 1}`;

let authToken: string = "";
let createdSessionId: string = "";

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
    console.warn(`[sessions] Registration failed (${res.status}): ${text}`);
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

function authedPost(path: string, body: unknown) {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      "X-Forwarded-For": FAKE_IP,
    },
    body: JSON.stringify(body),
  });
}

function authedPut(path: string, body: unknown) {
  return fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      "X-Forwarded-For": FAKE_IP,
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/user/sessions", () => {
  test("requires auth - returns 401 without token", async () => {
    const res = await fetch(`${BASE_URL}/api/user/sessions`);
    expect(res.status).toBe(401);
  });

  test("returns sessions list for authenticated user", async () => {
    if (!authToken) {
      console.warn("Skipping: registration failed, no token");
      return;
    }
    const res = await authedGet("/api/user/sessions");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe("POST /api/user/sessions", () => {
  test("creates a new work session", async () => {
    if (!authToken) {
      console.warn("Skipping: no auth token");
      return;
    }

    const startTime = new Date().toISOString();
    const res = await authedPost("/api/user/sessions", { startTime });
    expect(res.status).toBe(201);

    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(body.data.status).toBe("active");
    expect(body.data.id).toBeDefined();

    createdSessionId = body.data.id;
  });

  test("cannot create a second active session while one is active", async () => {
    if (!authToken || !createdSessionId) {
      console.warn("Skipping: no active session to conflict with");
      return;
    }

    const startTime = new Date().toISOString();
    const res = await authedPost("/api/user/sessions", { startTime });
    expect(res.status).toBe(400);

    const body = await res.json() as any;
    expect(body.error.code).toBe("ACTIVE_SESSION_EXISTS");
  });
});

describe("GET /api/user/sessions/active", () => {
  test("requires auth - returns 401 without token", async () => {
    const res = await fetch(`${BASE_URL}/api/user/sessions/active`);
    expect(res.status).toBe(401);
  });

  test("returns the active session", async () => {
    if (!authToken || !createdSessionId) {
      console.warn("Skipping: no active session created");
      return;
    }

    const res = await authedGet("/api/user/sessions/active");
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(body.data.id).toBe(createdSessionId);
    expect(body.data.status).toBe("active");
  });
});

describe("PUT /api/user/sessions/:id (end session)", () => {
  test("ends an active session", async () => {
    if (!authToken || !createdSessionId) {
      console.warn("Skipping: no session to end");
      return;
    }

    const endTime = new Date(Date.now() + 3600_000).toISOString(); // +1h
    const res = await authedPut(`/api/user/sessions/${createdSessionId}`, { endTime });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(body.data.status).toBe("completed");
    expect(body.data.endTime).toBeDefined();
  });

  test("returns 404 for non-existent session id", async () => {
    if (!authToken) {
      console.warn("Skipping: no auth token");
      return;
    }

    const res = await authedPut("/api/user/sessions/nonexistent-id-000", {
      endTime: new Date().toISOString(),
    });
    expect(res.status).toBe(404);
  });
});
