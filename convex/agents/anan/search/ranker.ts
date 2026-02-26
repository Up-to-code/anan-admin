import type { PropertyFinding } from "./types";

function normalizeUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.trim().replace(/\/+$/, "").toLowerCase() || null;
}

function findingScore(finding: PropertyFinding): number {
  const confidence = finding.confidence ?? 0;
  const hasImage = finding.imageUrls.length > 0 ? 0.12 : 0;
  const hasPrice = finding.priceHint ? 0.1 : 0;
  const hasLocation = finding.locationHint ? 0.08 : 0;
  const sourceBonus = Math.max(0, 0.2 - finding.sourceRank * 0.03);
  return confidence + hasImage + hasPrice + hasLocation + sourceBonus;
}

export function mergeAndRankFindings(
  portalFindings: PropertyFinding[],
  webFindings: PropertyFinding[],
): PropertyFinding[] {
  const merged: PropertyFinding[] = [];
  const seen = new Set<string>();
  for (const finding of [...portalFindings, ...webFindings]) {
    const key =
      normalizeUrl(finding.propertyUrl) ??
      `${finding.sourceUrl}|${finding.cardRank}|${finding.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(finding);
  }
  return merged.sort((a, b) => findingScore(b) - findingScore(a));
}
