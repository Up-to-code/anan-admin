/**
 * Bank domain types and validators.
 */
import { v } from "convex/values";
import type { Id, Doc } from "../_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export type BankStatus = "active" | "inactive" | "suspended";

export type Bank = Doc<"banks">;

export type BankProduct = Doc<"bankProducts">;

export type BankWithUrl = Omit<Bank, "logoId"> & {
  logoUrl?: string;
};

export interface BankCreateInput {
  name: string;
  slug: string;
  contactEmail: string;
  description?: string;
  status?: BankStatus;
  rules?: unknown;
  logoId?: Id<"_storage">;
}

export interface BankUpdateInput {
  name?: string;
  slug?: string;
  contactEmail?: string;
  description?: string;
  status?: BankStatus;
  rules?: unknown;
  logoId?: Id<"_storage">;
}

export interface BankProductInput {
  bankId: Id<"banks">;
  name: string;
  type: string;
  description?: string;
  rules?: unknown;
}

// ============================================================================
// Validators
// ============================================================================

export const bankStatusValidator = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("suspended")
);

export const bankProductTypeValidator = v.string(); // Could be more specific if needed

export const bankCreateArgsValidator = {
  name: v.string(),
  slug: v.string(),
  contactEmail: v.string(),
  description: v.optional(v.string()),
  status: v.optional(bankStatusValidator),
  rules: v.optional(v.any()),
  logoId: v.optional(v.id("_storage")),
};

export const bankUpdateArgsValidator = {
  id: v.id("banks"),
  name: v.optional(v.string()),
  slug: v.optional(v.string()),
  contactEmail: v.optional(v.string()),
  description: v.optional(v.string()),
  status: v.optional(bankStatusValidator),
  rules: v.optional(v.any()),
  logoId: v.optional(v.id("_storage")),
};

export const bankProductCreateArgsValidator = {
  bankId: v.id("banks"),
  name: v.string(),
  type: v.string(),
  description: v.optional(v.string()),
  rules: v.optional(v.any()),
};

// ============================================================================
// Return type validators
// ============================================================================

export const bankReturnValidator = v.object({
  _id: v.id("banks"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  contactEmail: v.string(),
  description: v.optional(v.string()),
  status: v.optional(bankStatusValidator),
  rules: v.optional(v.any()),
  // Legacy fields
  products: v.optional(v.array(v.object({
    name: v.string(),
    type: v.string(),
    description: v.optional(v.string()),
    rules: v.optional(v.any()),
  }))),
  state: v.optional(v.string()),
  logoUrl: v.optional(v.string()),
});

export const bankListReturnValidator = v.array(bankReturnValidator);

export const bankProductReturnValidator = v.object({
  _id: v.id("bankProducts"),
  _creationTime: v.number(),
  bankId: v.id("banks"),
  name: v.string(),
  type: v.string(),
  description: v.optional(v.string()),
  rules: v.optional(v.any()),
});

export const bankProductListReturnValidator = v.array(bankProductReturnValidator);
