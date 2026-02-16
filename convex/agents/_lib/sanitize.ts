/**
 * Text sanitization and extraction helpers.
 */

import { PROVIDER_BRAND_PATTERNS } from "./constants";

export function cleanWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function stripProviderBranding(input: string): string {
  let value = input;
  for (const pattern of PROVIDER_BRAND_PATTERNS) {
    value = value.replace(pattern, "");
  }
  value = value.replace(/\(\s*\)/g, "");
  value = value.replace(/\s+-\s+-/g, " - ");
  return cleanWhitespace(value);
}

export function sanitizeWebText(value: string | undefined, fallback = ""): string {
  const cleaned = stripProviderBranding(value ?? "");
  return cleaned.length > 0 ? cleaned : fallback;
}

export function extractPriceHint(text: string): string | undefined {
  const normalized = text.replace(/,/g, "");
  const moneyFirstMatch = normalized.match(
    /\b(?:SAR|USD|AED|ريال(?:\sسعودي)?)\s?\d{3,9}(?:\.\d{1,2})?\s?(?:million|m|k|ألف|مليون)?\b/i
  );
  if (moneyFirstMatch?.[0]) return moneyFirstMatch[0].trim();
  const match = normalized.match(
    /\b(?:SAR|USD|AED|ريال|ريال سعودي)?\s?\d{2,9}(?:\.\d{1,2})?\s?(?:million|m|k|ألف|مليون)?\b/i
  );
  return match?.[0]?.trim();
}

export function extractLocationHint(text: string): string | undefined {
  const match = text.match(/\b(?:in|at|near)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,3})\b/);
  return match?.[1]?.trim();
}

export function extractBathroomsHint(text: string): string | undefined {
  const match = text.match(/\b(\d+)\s*(?:bath|bathroom|baths|حمام|دورات?\s*مياه)/i);
  return match?.[1] ? `${match[1]} bath` : undefined;
}

export function extractAreaHint(text: string): string | undefined {
  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(?:sqm|sq\.?\s?m|m²|sqft|sq\.?\s?ft|قدم|متر|مساحة)/i
  );
  return match?.[0]?.trim();
}

export function extractBedsHint(text: string): string | undefined {
  const match = text.match(/\b(\d+)\s*(?:bed|bedroom|beds|غرفة|غرف|نوم)/i);
  return match?.[1] ? `${match[1]} bed` : undefined;
}

export function tokenizeTitle(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}
