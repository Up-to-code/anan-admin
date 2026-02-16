/**
 * Shared output validators for queries and mutations.
 * Use these instead of defining inline validators in each file.
 */

import { v } from "convex/values";
import {
  propertyStatusValidator,
} from "./property";
import { bankStatusValidator } from "./bank";

/** Property with optional imageUrl (from storage). */
export const propertyWithUrlValidator = v.object({
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
  searchText: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
});

/** Bank document (for list/get). */
export const bankValidator = v.object({
  _id: v.id("banks"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  contactEmail: v.string(),
  description: v.optional(v.string()),
  status: v.optional(bankStatusValidator),
  rules: v.optional(v.any()),
  products: v.optional(v.array(v.object({
    name: v.string(),
    type: v.string(),
    description: v.optional(v.string()),
    rules: v.optional(v.any()),
  }))),
  state: v.optional(v.string()),
  logoId: v.optional(v.id("_storage")),
});

/** Bank product/bundle (for getBundles). */
export const bankBundleValidator = v.object({
  bankName: v.string(),
  bankSlug: v.string(),
  bankId: v.id("banks"),
  name: v.string(),
  type: v.string(),
  description: v.optional(v.string()),
  rules: v.optional(v.any()),
});
