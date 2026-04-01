import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import { randomUUID } from "node:crypto";
import { env } from "./env";
import { initSentry, captureException } from "./lib/sentry";
import { workclockRoutes } from "./routes/workclock";
import { authRoutes } from "./routes/auth";
import { adminRoutes, adminPublicRoutes } from "./routes/admin";
import { legalRoutes } from "./routes/legal";
import subscriptionRouter from "./routes/subscription";
import { httpLogger, logger, setErrorReporter } from "./lib/logger";

// Initialize Sentry error reporting before anything else
initSentry();
setErrorReporter(captureException);

const app = new Hono();

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.dev$/,
  /^https:\/\/vibecode\.dev$/,
];

const extraOrigins = env.ALLOWED_ORIGINS
  ? env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

app.use(
  "*",
  cors({
    origin: (origin) =>
      origin && (allowed.some((re) => re.test(origin)) || extraOrigins.includes(origin))
        ? origin
        : null,
    credentials: true,
  })
);

// Correlation ID middleware
app.use("*", async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? randomUUID();
  c.header("x-request-id", requestId);
  // Make it available to downstream handlers
  (c as any).requestId = requestId;
  await next();
});

// Logging
app.use("*", httpLogger);

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Routes
app.route("", workclockRoutes);
app.route("/api/auth", authRoutes);
// Public admin routes (no auth) must be mounted before protected ones
app.route("/api/admin", adminPublicRoutes);
app.route("/api/admin", adminRoutes);
// Subscription routes
app.route("/api/subscription", subscriptionRouter);
// Public legal pages (privacy policy, delete account)
app.route("", legalRoutes);

// Global unhandled error catcher
app.onError((err, c) => {
  captureException(err, {
    method: c.req.method,
    path: new URL(c.req.url).pathname,
  });
  logger.error("unhandled error", {
    error: err,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
  });
  return c.json(
    { error: { message: "שגיאה פנימית בשרת", code: "INTERNAL_ERROR" } },
    500
  );
});

// 404 handler
app.notFound((c) => {
  return c.json(
    { error: { message: "הנתיב לא נמצא", code: "NOT_FOUND" } },
    404
  );
});

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
