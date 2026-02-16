/**
 * Location and URL helpers for property search.
 */

import { BLOCKED_DOMAINS, SAUDI_CITIES } from "./constants";

export { SAUDI_CITIES };

export function extractQueryLocation(query: string): string | undefined {
  const normalized = query.toLowerCase();
  for (const city of SAUDI_CITIES) {
    if (normalized.includes(city.toLowerCase())) {
      return city;
    }
  }
  return undefined;
}

export function inferCountryFromLocation(locationHint?: string): string | undefined {
  const value = (locationHint ?? "").toLowerCase();
  if (!value) return undefined;
  if (
    value.includes("riyadh") ||
    value.includes("jeddah") ||
    value.includes("dammam") ||
    value.includes("saudi") ||
    value.includes("السعود") ||
    value.includes("الرياض") ||
    value.includes("جدة") ||
    value.includes("الدمام")
  ) {
    return "Saudi Arabia";
  }
  if (
    value.includes("dubai") ||
    value.includes("abu dhabi") ||
    value.includes("sharjah") ||
    value.includes("uae") ||
    value.includes("الإمارات") ||
    value.includes("دبي") ||
    value.includes("أبوظبي")
  ) {
    return "United Arab Emirates";
  }
  return undefined;
}

export function isLikelyHomePageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return path === "" || ["/", "/home", "/index", "/index.html", "/ar", "/en"].includes(path);
  } catch {
    return false;
  }
}

export function isLikelyPropertyDetailUrl(url: string): boolean {
  if (!url || isLikelyHomePageUrl(url)) return false;
  const lower = url.toLowerCase();
  if (lower.includes("wasalt.sa") && lower.includes("/property/") && /-\d{5,}/.test(url)) return true;
  if (lower.includes("bayut.sa") && (lower.includes("تفاصيل") || lower.includes("detail")) && /\d{6,}/.test(url)) return true;
  if ((lower.includes("aqar.forsale") || lower.includes("sa.aqar.forsale")) && (lower.includes("/property") || lower.includes("/listing"))) return true;
  const detailTokens = [
    "/property",
    "/properties/",
    "/listing",
    "/listings/",
    "/apartment",
    "/villa",
    "/unit",
    "/offer",
    "/detail",
    "/sale",
    "/rent",
  ];
  if (detailTokens.some((token) => lower.includes(token))) return true;
  return /\/\d{4,}/.test(lower) || /-\d{5,}/.test(url);
}

export function isBlockedDomain(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return BLOCKED_DOMAINS.some((domain) => lowerUrl.includes(domain));
}

export function getDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.toLowerCase();
  } catch {
    return "";
  }
}
