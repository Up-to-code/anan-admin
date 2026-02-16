/**
 * Agent feature module.
 * Re-exports agent functionality for cleaner imports.
 */

// Agent actions (chat, threads)
export * from "./actions";

// Agent factory
export { createRealEstateAgent } from "./factory";

// Admin agent (in features/admin)
export * from "../admin/agentActions";
export { createAdminAgent } from "../admin/agent";
