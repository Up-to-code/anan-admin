/**
 * Features index.
 * 
 * This directory contains feature modules organized by domain:
 * 
 * - admin/     - Admin panel functionality
 * - agent/     - AI agent and chat functionality
 * - auth/      - Authentication and OTP verification
 * - banks/     - Bank management
 * - content/   - Knowledge pages, prompts, handoffs
 * - orders/    - Order/pipeline management (via admin)
 * - partners/  - Partner management
 * - properties/ - Property listings
 * - users/     - User profiles and favorites
 * 
 * Each feature module exports its functionality through an index.ts file.
 * Import from the feature directly for cleaner imports:
 * 
 * @example
 * import { list } from "./features/properties/queries";
 * import { requireAdmin } from "./lib/auth";
 */

// Note: We don't re-export all features here to avoid circular dependencies.
// Import from specific feature modules instead.
