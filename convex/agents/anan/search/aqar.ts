/**
 * Aqar (aqar.forsale, sa.aqar.forsale) - stub for future implementation.
 * URL patterns to be discovered during implementation.
 */

import type { PropertyCardCandidate, StagehandState } from "./types";

export function buildAqarSearchUrl(_query: string, _page?: number): string | null {
  return null;
}

export async function extractAqarListingCards(
  _ctx: unknown,
  _listingUrl: string,
  _maxCards: number,
  _state: StagehandState
): Promise<PropertyCardCandidate[]> {
  return [];
}
