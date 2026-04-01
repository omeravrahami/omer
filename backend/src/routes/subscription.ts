import { Hono } from "hono";

type AuthVariables = { userId: string };

export const subscriptionRouter = new Hono<{ Variables: AuthVariables }>();

// Routes are handled in workclock.ts to avoid duplicates.
// This router is kept as a placeholder for future subscription-specific routes.

export default subscriptionRouter;
