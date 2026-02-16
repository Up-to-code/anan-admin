/**
 * Custom error types for consistent error handling across the Convex backend.
 * All errors extend ConvexError for proper client-side handling.
 */
import { ConvexError } from "convex/values";

/** Error codes used throughout the application */
export const ErrorCodes = {
  // Authentication errors
  AUTH_ERROR: "AUTH_ERROR",
  FORBIDDEN: "FORBIDDEN",
  
  // Resource errors
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  
  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  
  // Rate limiting
  RATE_LIMITED: "RATE_LIMITED",
  
  // Business logic errors
  INVALID_STATE: "INVALID_STATE",
  OPERATION_FAILED: "OPERATION_FAILED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Authentication error - user is not authenticated
 */
export function authError(message = "Authentication required") {
  return new ConvexError({ code: ErrorCodes.AUTH_ERROR, message });
}

/**
 * Forbidden error - user is authenticated but not authorized
 */
export function forbiddenError(message = "Access denied") {
  return new ConvexError({ code: ErrorCodes.FORBIDDEN, message });
}

/**
 * Not found error - requested resource does not exist
 */
export function notFoundError(resource: string) {
  return new ConvexError({
    code: ErrorCodes.NOT_FOUND,
    message: `${resource} not found`,
  });
}

/**
 * Already exists error - resource already exists (e.g., duplicate)
 */
export function alreadyExistsError(resource: string) {
  return new ConvexError({
    code: ErrorCodes.ALREADY_EXISTS,
    message: `${resource} already exists`,
  });
}

/**
 * Validation error - input validation failed
 */
export function validationError(field: string, message: string) {
  return new ConvexError({
    code: ErrorCodes.VALIDATION_ERROR,
    message,
    field,
  });
}

/**
 * Invalid input error - general input validation failure
 */
export function invalidInputError(message: string) {
  return new ConvexError({
    code: ErrorCodes.INVALID_INPUT,
    message,
  });
}

/**
 * Rate limited error - too many requests
 */
export function rateLimitedError(retryAfterSeconds?: number) {
  return new ConvexError({
    code: ErrorCodes.RATE_LIMITED,
    message: "Too many requests. Please try again later.",
    ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
  });
}

/**
 * Invalid state error - operation not allowed in current state
 */
export function invalidStateError(message: string) {
  return new ConvexError({
    code: ErrorCodes.INVALID_STATE,
    message,
  });
}

/**
 * Operation failed error - general operation failure
 */
export function operationFailedError(message: string) {
  return new ConvexError({
    code: ErrorCodes.OPERATION_FAILED,
    message,
  });
}

/**
 * Extract error message from any error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data;
    if (typeof data === "object" && data !== null && "message" in data) {
      const msg = (data as Record<string, unknown>).message;
      if (typeof msg === "string") {
        return msg;
      }
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
}

/**
 * Extract error code from a ConvexError
 */
export function getErrorCode(error: unknown): ErrorCode | null {
  if (error instanceof ConvexError) {
    const data = error.data;
    if (typeof data === "object" && data !== null && "code" in data) {
      const code = (data as Record<string, unknown>).code;
      if (typeof code === "string" && Object.values(ErrorCodes).includes(code as ErrorCode)) {
        return code as ErrorCode;
      }
    }
  }
  return null;
}
