/**
 * Better Auth API Route - proxies to Convex
 */
import { handler } from "@/lib/auth-server";

export const { GET, POST } = handler;
