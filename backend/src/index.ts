import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import "./env";
import { sampleRouter } from "./routes/sample";
import { workclockRoutes } from "./routes/workclock";
import { authRoutes } from "./routes/auth";
import { adminRoutes, adminPublicRoutes } from "./routes/admin";
import { httpLogger } from "./lib/logger";

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

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

// Logging
app.use("*", httpLogger);

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Routes
app.route("/api/sample", sampleRouter);
app.route("", workclockRoutes);
app.route("/api/auth", authRoutes);
// Public admin routes (no auth) must be mounted before protected ones
app.route("/api/admin", adminPublicRoutes);
app.route("/api/admin", adminRoutes);

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
