/**
 * Auth feature module.
 * Re-exports authentication functionality for cleaner imports.
 */

// Auth actions (OTP verification)
export * from "./actions";

// Auth setup (Better Auth)
export { authComponent, createAuth, getCurrentUser } from "../../auth";

// Auth utilities
export * from "../../lib/auth";
