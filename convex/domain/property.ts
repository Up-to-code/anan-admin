/**
 * Property domain types and validators.
 */
import { v } from "convex/values";
import type { Id, Doc } from "../_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export type PropertyStatus = "available" | "sold" | "reserved";

export type Property = Doc<"properties">;

export type PropertyWithUrl = Omit<Property, "imageId"> & {
  imageUrl?: string;
};

export interface PropertyCreateInput {
  title: string;
  address: string;
  price: number;
  beds: number;
  baths: number;
  sqft?: number;
  description: string;
  location?: string;
  area?: string;
  status?: PropertyStatus;
  partnerId?: Id<"partners">;
  bankId?: Id<"banks">;
  imageId?: Id<"_storage">;
}

export interface PropertyUpdateInput {
  title?: string;
  address?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  description?: string;
  location?: string;
  area?: string;
  status?: PropertyStatus;
  partnerId?: Id<"partners">;
  bankId?: Id<"banks">;
  imageId?: Id<"_storage">;
}

export interface PropertySearchFilters {
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  location?: string;
  area?: string;
  status?: PropertyStatus;
  partnerId?: Id<"partners">;
  bankId?: Id<"banks">;
}

// ============================================================================
// Validators
// ============================================================================

export const propertyStatusValidator = v.union(
  v.literal("available"),
  v.literal("sold"),
  v.literal("reserved")
);

export const propertyCreateArgsValidator = {
  title: v.string(),
  address: v.string(),
  price: v.number(),
  beds: v.number(),
  baths: v.number(),
  sqft: v.optional(v.number()),
  description: v.string(),
  location: v.optional(v.string()),
  area: v.optional(v.string()),
  status: v.optional(propertyStatusValidator),
  partnerId: v.optional(v.id("partners")),
  bankId: v.optional(v.id("banks")),
  imageId: v.optional(v.id("_storage")),
};

export const propertyUpdateArgsValidator = {
  id: v.id("properties"),
  title: v.optional(v.string()),
  address: v.optional(v.string()),
  price: v.optional(v.number()),
  beds: v.optional(v.number()),
  baths: v.optional(v.number()),
  sqft: v.optional(v.number()),
  description: v.optional(v.string()),
  location: v.optional(v.string()),
  area: v.optional(v.string()),
  status: v.optional(propertyStatusValidator),
  partnerId: v.optional(v.id("partners")),
  bankId: v.optional(v.id("banks")),
  imageId: v.optional(v.id("_storage")),
};

export const propertySearchFiltersValidator = {
  minPrice: v.optional(v.number()),
  maxPrice: v.optional(v.number()),
  minBeds: v.optional(v.number()),
  maxBeds: v.optional(v.number()),
  minBaths: v.optional(v.number()),
  maxBaths: v.optional(v.number()),
  location: v.optional(v.string()),
  area: v.optional(v.string()),
  status: v.optional(propertyStatusValidator),
  partnerId: v.optional(v.id("partners")),
  bankId: v.optional(v.id("banks")),
};

// ============================================================================
// Return type validators (for query/mutation returns)
// ============================================================================

export const propertyReturnValidator = v.object({
  _id: v.id("properties"),
  _creationTime: v.number(),
  title: v.string(),
  address: v.string(),
  price: v.number(),
  beds: v.number(),
  baths: v.number(),
  sqft: v.optional(v.number()),
  description: v.string(),
  location: v.optional(v.string()),
  area: v.optional(v.string()),
  status: v.optional(propertyStatusValidator),
  partnerId: v.optional(v.id("partners")),
  bankId: v.optional(v.id("banks")),
  body: v.optional(v.any()),
  imageUrl: v.optional(v.string()),
});

export const propertyListReturnValidator = v.array(propertyReturnValidator);
