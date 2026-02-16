/**
 * Convex + Better Auth Next.js server utilities.
 * Proxies auth requests to Convex deployment.
 */
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

export const { handler, isAuthenticated, getToken } = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
});
