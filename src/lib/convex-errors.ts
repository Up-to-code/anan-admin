type ConvexAuthErrorLike = {
  message?: string;
  data?: {
    code?: string;
    message?: string;
  };
};

const AUTH_ERROR_CODES = new Set(["AUTH_ERROR", "UNAUTHENTICATED"]);

function includesAuthFailureText(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("unauthenticated") ||
    normalized.includes("authentication required") ||
    normalized.includes("auth_error")
  );
}

export function isConvexAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const typed = error as ConvexAuthErrorLike;

  if (typed.data?.code && AUTH_ERROR_CODES.has(typed.data.code)) {
    return true;
  }

  if (typed.data?.message && includesAuthFailureText(typed.data.message)) {
    return true;
  }

  if (typed.message && includesAuthFailureText(typed.message)) {
    return true;
  }

  return false;
}
