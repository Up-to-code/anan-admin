/**
 * Phone number utilities for consistent handling across the codebase.
 */
import { validationError } from "./errors";

/**
 * Normalize a phone number by removing all non-digit characters.
 * This is the standard format for storing and comparing phone numbers.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Validate and normalize a phone number.
 * Throws a validation error if the phone number is invalid.
 * 
 * @param phone - The phone number to validate
 * @param fieldName - The field name for error messages (default: "phoneNumber")
 * @returns The normalized phone number (digits only)
 */
export function validatePhone(phone: string, fieldName = "phoneNumber"): string {
  const normalized = normalizePhone(phone);
  
  if (!normalized) {
    throw validationError(fieldName, "Phone number is required");
  }
  
  if (normalized.length < 10) {
    throw validationError(fieldName, "Phone number must be at least 10 digits");
  }
  
  if (normalized.length > 15) {
    throw validationError(fieldName, "Phone number must be at most 15 digits");
  }
  
  return normalized;
}

/**
 * Check if a string looks like a phone number (without throwing).
 */
export function isValidPhoneFormat(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return normalized.length >= 10 && normalized.length <= 15;
}

/**
 * Format a phone number for display.
 * Currently returns the normalized number, but can be extended for locale-specific formatting.
 */
export function formatPhoneForDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  
  // Basic international format: +X XXX XXX XXXX
  if (normalized.length >= 10) {
    // Assuming country code is first 1-3 digits
    if (normalized.length === 10) {
      // US format: (XXX) XXX-XXXX
      return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
    }
    // International format with country code
    return `+${normalized}`;
  }
  
  return normalized;
}

/**
 * Check if a message looks like an OTP code.
 * Used to determine if a WhatsApp message should trigger OTP verification.
 */
export function isOtpLike(text: string): boolean {
  const trimmed = text.trim();
  return /^\d{4,6}$/.test(trimmed);
}

/**
 * Generate a random OTP code.
 * Uses crypto.getRandomValues when available for better randomness.
 * 
 * @param length - The length of the OTP (default: 6)
 */
export function generateOtp(length = 6): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  
  // Try to use crypto for better randomness
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const randomValue = array[0] / (0xffffffff + 1);
    return Math.floor(min + randomValue * (max - min + 1)).toString();
  }
  
  // Fallback to Math.random
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

/**
 * Generate a secure session token.
 * Uses crypto.getRandomValues when available.
 */
export function generateSessionToken(): string {
  const arr = new Uint8Array(32);
  
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    // Fallback (less secure, but works in all environments)
    for (let i = 0; i < 32; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
