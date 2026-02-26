/**
 * Shared utility functions used across agent modules.
 * Consolidates duplicated helpers (isTruthyEnv, hashRoutingKey, etc.)
 */

/**
 * Check if a string env var represents a truthy value.
 * Accepts: "1", "true", "yes", "on" (case-insensitive).
 */
export function isTruthyEnv(value: string | undefined): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return (
        normalized === "1" ||
        normalized === "true" ||
        normalized === "yes" ||
        normalized === "on"
    );
}

/**
 * FNV-1a 32-bit hash for deterministic routing.
 * Returns an unsigned 32-bit integer.
 */
export function fnv1aHash(input: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/**
 * Parse a positive integer from a string, returning fallback if invalid.
 */
export function parsePositiveInt(raw: string | undefined, fallback: number): number {
    if (!raw) return fallback;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}
