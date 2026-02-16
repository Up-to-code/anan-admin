/**
 * Better Auth client for admin.
 * Uses email/password (no phone auth) for admin sign-in.
 */
import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002",
  plugins: [convexClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
