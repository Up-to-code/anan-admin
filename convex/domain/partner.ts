/**
 * Partner domain types and validators.
 */
import { v } from "convex/values";
import type { Id, Doc } from "../_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export type PartnerStatus = "active" | "pending";

export type Partner = Doc<"partners">;

export type PartnerWithUrl = Omit<Partner, "logoId"> & {
  logoUrl?: string;
};

export interface PartnerCreateInput {
  name: string;
  slug: string;
  status?: PartnerStatus;
  contactEmail?: string;
  phone?: string;
  description?: string;
  website?: string;
  logoId?: Id<"_storage">;
}

export interface PartnerUpdateInput {
  name?: string;
  slug?: string;
  status?: PartnerStatus;
  contactEmail?: string;
  phone?: string;
  description?: string;
  website?: string;
  logoId?: Id<"_storage">;
}

// ============================================================================
// Validators
// ============================================================================

export const partnerStatusValidator = v.union(
  v.literal("active"),
  v.literal("pending")
);

export const partnerCreateArgsValidator = {
  name: v.string(),
  slug: v.string(),
  status: v.optional(partnerStatusValidator),
  contactEmail: v.optional(v.string()),
  phone: v.optional(v.string()),
  description: v.optional(v.string()),
  website: v.optional(v.string()),
  logoId: v.optional(v.id("_storage")),
};

export const partnerUpdateArgsValidator = {
  id: v.id("partners"),
  name: v.optional(v.string()),
  slug: v.optional(v.string()),
  status: v.optional(partnerStatusValidator),
  contactEmail: v.optional(v.string()),
  phone: v.optional(v.string()),
  description: v.optional(v.string()),
  website: v.optional(v.string()),
  logoId: v.optional(v.id("_storage")),
};

// ============================================================================
// Return type validators
// ============================================================================

export const partnerReturnValidator = v.object({
  _id: v.id("partners"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  status: v.optional(partnerStatusValidator),
  contactEmail: v.optional(v.string()),
  phone: v.optional(v.string()),
  description: v.optional(v.string()),
  website: v.optional(v.string()),
  apiKeyHash: v.optional(v.string()),
  logoUrl: v.optional(v.string()),
});

export const partnerListReturnValidator = v.array(partnerReturnValidator);
