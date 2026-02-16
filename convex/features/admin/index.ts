/**
 * Admin feature module.
 * Re-exports admin functionality for cleaner imports.
 */

// Admin API
export * from "./api";

// Admin agent
export { createAdminAgent } from "./agent";

// Admin agent actions
export * from "./agentActions";
