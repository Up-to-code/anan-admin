/**
 * Orders feature module.
 * 
 * Order management is handled through the admin API.
 * This module provides a convenient re-export.
 * 
 * Available functions via api.features.admin.api:
 * - ordersList
 * - orderCreate
 * - orderUpdate
 * - orderRemove
 * - orderGet
 * - ordersForUser
 * - ordersForProperty
 * - ordersForBank
 */

// Re-export order domain types
export * from "../../domain/order";
