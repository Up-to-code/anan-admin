import { selectTopSources } from "./serper";
import type { SerperResult, SerperImageResult } from "./types";

function normalizeUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.trim().replace(/\/+$/, "").toLowerCase() || null;
}

export function selectCandidateSources(params: {
  portalSources: SerperResult[];
  webResults: SerperResult[];
  webImages: SerperImageResult[];
}): SerperResult[] {
  const selected = selectTopSources(params.webResults, params.webImages);
  if (params.portalSources.length === 0) return selected;
  const seen = new Set(
    params.portalSources
      .map((source) => normalizeUrl(source.externalUrl))
      .filter((url): url is string => Boolean(url)),
  );
  const merged = [...params.portalSources];
  for (const source of selected) {
    const key = normalizeUrl(source.externalUrl);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    merged.push(source);
  }
  return merged;
}
