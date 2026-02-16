import { v } from "convex/values";

/** Shared validator for user role. Use in schema and mutation args. */
export const roleValidator = v.union(
  v.literal("user"),
  v.literal("admin")
);

export type Role = "user" | "admin";

/** Role constants for runtime checks (e.g. requireAdmin). */
export const ROLE_USER = "user" as const;
export const ROLE_ADMIN = "admin" as const;
