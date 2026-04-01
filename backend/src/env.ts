import { z } from "zod";

/**
 * Environment variable schema using Zod
 * This ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  // Server Configuration
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.string().optional(),
  BACKEND_URL: z.string().optional().default("http://localhost:3000"),
  // Database
  // Production: change to postgresql://... for PostgreSQL/Supabase
  // Dev: defaults to SQLite (file:./dev.db)
  DATABASE_URL: z.string().optional().default("file:./dev.db"),
  // Email
  RESEND_API_KEY: z.string().optional(),
  // Admin setup protection
  SETUP_SECRET: z.string().optional(),
  // Logging level — "debug" | "info" | "warn" | "error"
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  // Crash reporting — Sentry DSN (optional, enables error tracking)
  SENTRY_DSN: z.string().optional(),
  // CORS — comma-separated list of extra allowed origins (e.g. https://myapp.com,https://admin.myapp.com)
  ALLOWED_ORIGINS: z.string().optional().default(""),
});

/**
 * Validate and parse environment variables
 */
function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env);
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment variable validation failed:");
      error.issues.forEach((err: any) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      console.error("\nPlease check your .env file and ensure all required variables are set.");
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validated and typed environment variables
 */
export const env = validateEnv();

// Warn loudly if SETUP_SECRET is not set in production
if (process.env.NODE_ENV === "production" && !env.SETUP_SECRET) {
  console.warn("WARNING: SETUP_SECRET is not set. The /api/admin/setup endpoint is unprotected in production. Set SETUP_SECRET env var immediately.");
}

// Warn if DATABASE_URL still points to SQLite in production
if (process.env.NODE_ENV === "production" && env.DATABASE_URL.startsWith("file:")) {
  console.warn("WARNING: DATABASE_URL is set to a SQLite file in production. Switch to PostgreSQL (postgresql://...) for production workloads.");
}

// Warn if BACKEND_URL is still localhost in production
if (process.env.NODE_ENV === "production" && (env.BACKEND_URL.includes("localhost") || env.BACKEND_URL.includes("127.0.0.1"))) {
  console.warn("WARNING: BACKEND_URL is set to a localhost address in production. Set BACKEND_URL to the public URL of this server.");
}

/**
 * Type of the validated environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Extend process.env with our environment variables
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    // eslint-disable-next-line import/namespace
    interface ProcessEnv extends z.infer<typeof envSchema> {}
  }
}
