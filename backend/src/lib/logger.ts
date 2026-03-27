import type { Context, Next } from "hono";

// ---------------------------------------------------------------------------
// Log level
// ---------------------------------------------------------------------------

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const currentLevel: LogLevel = resolveLogLevel();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[currentLevel];
}

// ---------------------------------------------------------------------------
// Structured log entry
// ---------------------------------------------------------------------------

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Error reporter hook (Sentry plug-in interface)
// ---------------------------------------------------------------------------

type ErrorReporter = (error: Error, context?: Record<string, unknown>) => void;

let errorReporter: ErrorReporter | null = null;

export function setErrorReporter(reporter: ErrorReporter): void {
  errorReporter = reporter;
}

// ---------------------------------------------------------------------------
// Core log function
// ---------------------------------------------------------------------------

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: "workclock-api",
    message,
    ...(data !== undefined ? { data } : {}),
  };

  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(serialized);
    if (errorReporter && data?.["error"] instanceof Error) {
      const { error, ...rest } = data;
      errorReporter(error as Error, rest as Record<string, unknown>);
    }
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

// ---------------------------------------------------------------------------
// Logger object
// ---------------------------------------------------------------------------

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
  info:  (msg: string, data?: Record<string, unknown>) => log("info",  msg, data),
  warn:  (msg: string, data?: Record<string, unknown>) => log("warn",  msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
};

// ---------------------------------------------------------------------------
// HTTP request/response middleware for Hono
// ---------------------------------------------------------------------------

export async function httpLogger(c: Context, next: Next): Promise<void> {
  const start = Date.now();
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;

  await next();

  const status = c.res.status;
  const duration = Date.now() - start;

  const level: LogLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  log(level, "http request", {
    method,
    path,
    status,
    durationMs: duration,
  });
}
