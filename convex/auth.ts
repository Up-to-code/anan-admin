import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { requireRunMutationCtx } from "@convex-dev/better-auth/utils";
import { expo } from "@better-auth/expo";

import { components } from "./_generated/api";
import { internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";

import { query } from "./_generated/server";
import { v } from "convex/values";
import { betterAuth } from "better-auth/minimal";
import { ROLE_ADMIN } from "./roles";
import { phoneNumber } from "better-auth/plugins/phone-number";
import authConfig from "./auth.config";

const siteUrl =
  process.env.SITE_URL ?? "https://outstanding-mastiff-930.convex.site";

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    trustedOrigins: [
      siteUrl,
      "anan://",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3002",
      "http://127.0.0.1:3003",
      "http://192.168.1.75:3002",
      // Expo dev client (replace IP with your machine's if different)
      "exp://192.168.1.75:8081",
      "exp://localhost:8081",
    ],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      expo(),
      convex({ authConfig }),
      phoneNumber({
        allowedAttempts: 10,
        sendOTP: async () => {
          throw new Error("Use WhatsApp verification flow.");
        },
        verifyOTP: async ({ phoneNumber, code }) => {
          const runCtx = requireRunMutationCtx(ctx);
          return await runCtx.runMutation(
            internal.features.auth.actions.consumeSessionToken,
            {
              phoneNumber,
              token: code,
            },
          );
        },
        phoneNumberValidator: async (phoneNumber) => {
          const normalized = phoneNumber.replace(/\D/g, "");
          return normalized.length >= 10 && normalized.length <= 15;
        },
        signUpOnVerification: {
          getTempEmail: (phoneNumber) => {
            const normalized = phoneNumber.replace(/\D/g, "");
            return `${normalized}@whatsapp.local`;
          },
          getTempName: (phoneNumber) => phoneNumber,
        },
      }),
    ],
  });
};

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    try {
      return await authComponent.getAuthUser(ctx);
    } catch {
      return null;
    }
  },
});

/** Part A: Check if a user (e.g. from session) is admin. Used by HTTP test routes. */
export const isUserAdmin = query({
  args: { userId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { userId }) => {
    const legacyAdmin = await ctx.db
      .query("adminUsers")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (legacyAdmin) return true;
    const verified = await ctx.db
      .query("verifiedPhones")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (verified) {
      const normalized = verified.phoneNumber.replace(/\D/g, "");
      const roleRow = await ctx.db
        .query("userRoles")
        .withIndex("phoneNumber", (q) => q.eq("phoneNumber", normalized))
        .first();
      if (roleRow?.role === ROLE_ADMIN) return true;
    }
    return false;
  },
});
