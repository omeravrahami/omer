import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import bcrypt from "bcryptjs";
import { db } from "../db";
import { authMiddleware } from "../middleware/auth";

export const authRoutes = new Hono();

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email: z.string().email("Invalid email format").toLowerCase(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function createExpiryDate(): Date {
  return new Date(Date.now() + THIRTY_DAYS_MS);
}

async function createSessionToken(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  await db.userSession.create({
    data: {
      userId,
      token,
      expiresAt: createExpiryDate(),
    },
  });
  return token;
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

authRoutes.post(
  "/register",
  zValidator("json", registerSchema),
  async (c) => {
    const { email, password } = c.req.valid("json");

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return c.json(
        { error: { message: "Email already in use", code: "EMAIL_TAKEN" } },
        409
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: { email, passwordHash },
    });

    const token = await createSessionToken(user.id);

    return c.json(
      {
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            createdAt: user.createdAt,
          },
        },
      },
      201
    );
  }
);

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

authRoutes.post(
  "/login",
  zValidator("json", loginSchema),
  async (c) => {
    const { email, password } = c.req.valid("json");

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return c.json(
        { error: { message: "Invalid email or password", code: "INVALID_CREDENTIALS" } },
        401
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return c.json(
        { error: { message: "Invalid email or password", code: "INVALID_CREDENTIALS" } },
        401
      );
    }

    const token = await createSessionToken(user.id);

    return c.json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
        },
      },
    });
  }
);

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

authRoutes.post("/logout", async (c) => {
  const authorization = c.req.header("Authorization");
  if (authorization && authorization.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    await db.userSession.deleteMany({ where: { token } }).catch(() => {});
  }
  return c.json({ data: { success: true } });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

authRoutes.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, createdAt: true },
  });

  if (!user) {
    return c.json(
      { error: { message: "User not found", code: "NOT_FOUND" } },
      404
    );
  }

  return c.json({ data: user });
});

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password-request
// ---------------------------------------------------------------------------

authRoutes.post(
  "/reset-password-request",
  zValidator("json", z.object({ email: z.string().email() })),
  async (_c) => {
    // Email delivery not yet implemented — always return success to avoid
    // leaking whether an account exists for a given email.
    return _c.json({ data: { success: true } });
  }
);
