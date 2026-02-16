/**
 * TOON (Token-Oriented Object Notation) Encode Utility
 *
 * WHAT IS TOON?
 * -------------
 * TOON is a compact, human-readable encoding of the JSON data model designed
 * specifically for LLM (Large Language Model) prompts. It was created to address
 * the token inefficiency of JSON when passing structured data to AI models.
 *
 * See: https://toonformat.dev/
 *
 * HOW IT WORKS:
 * -------------
 * - Objects: Use "key: value" syntax with indentation instead of braces.
 *   Nested objects add one indentation level (default 2 spaces).
 *
 * - Arrays: TOON detects structure and picks the most efficient representation:
 *   - Primitive arrays: Inline with delimiter, e.g. tags[3]: admin,ops,dev
 *   - Uniform object arrays: Tabular format - declare fields ONCE in a header,
 *     then stream rows as CSV. Example:
 *     items[2]{sku,qty,price}:
 *       A1,2,9.99
 *       B2,1,14.5
 *
 * - Key features:
 *   - [N] = explicit array length (helps LLMs validate structure)
 *   - {field1,field2} = field headers for tabular arrays
 *   - Minimal quoting (only when necessary)
 *   - Tab delimiter option for even fewer tokens
 *
 * WHY USE IT:
 * -----------
 * 1. Token savings: ~30-60% fewer tokens than JSON for arrays of objects.
 *    Benchmarks show 74% accuracy (vs JSON's 70%) with ~40% fewer tokens.
 *
 * 2. LLM-friendly: Explicit [N] lengths and {fields} headers give models
 *    a clear schema to follow, improving parsing reliability.
 *
 * 3. Same data model: Lossless round-trip with JSON - objects, arrays,
 *    primitives - no semantic changes.
 *
 * 4. Our use case: Agent tool handlers (searchProperties, getBankInfo, etc.)
 *    return structured data to the LLM. Properties, banks, and partners are
 *    often arrays of objects - exactly where TOON saves the most tokens.
 *    Less tokens = lower cost and faster responses.
 */

import { encode } from "@toon-format/toon";

/**
 * Encode data as TOON for LLM consumption.
 *
 * Converts arbitrary data to TOON format. Ensures Convex IDs and other
 * non-JSON-serializable values are converted to plain values before encoding.
 * Falls back to JSON.stringify if TOON encode fails.
 *
 * @param data - Data to encode (objects, arrays, primitives)
 * @returns TOON-formatted string
 */
export function toonEncode(data: unknown): string {
  try {
    // Normalize to plain JSON-serializable structure. Convex IDs are strings at
    // runtime; JSON.parse(JSON.stringify()) handles Dates, undefined, etc.
    const plain = JSON.parse(JSON.stringify(data ?? null));
    return encode(plain, {
      delimiter: "\t", // Tab delimiter often tokenizes more efficiently than comma
    });
  } catch {
    // Fallback to JSON if TOON encode fails (e.g. non-serializable, edge cases)
    return JSON.stringify(data);
  }
}
