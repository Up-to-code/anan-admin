/**
 * Lightweight language detection helpers for user-facing text.
 * We only distinguish Arabic and English for channel responses.
 */

export type PreferredLanguage = "ar" | "en";

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF]/g;
const LATIN_CHAR_REGEX = /[A-Za-z]/g;

function countMatches(text: string, regex: RegExp): number {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

export function countArabicChars(text: string): number {
  return countMatches(text, ARABIC_CHAR_REGEX);
}

export function countLatinChars(text: string): number {
  return countMatches(text, LATIN_CHAR_REGEX);
}

export function hasArabicChars(text: string): boolean {
  return countArabicChars(text) > 0;
}

export function hasLatinChars(text: string): boolean {
  return countLatinChars(text) > 0;
}

export function detectPreferredLanguage(text: string | undefined): PreferredLanguage {
  const value = (text ?? "").trim();
  if (!value) return "ar";

  const arabic = countArabicChars(value);
  const latin = countLatinChars(value);

  if (arabic === 0 && latin > 0) return "en";
  if (latin === 0 && arabic > 0) return "ar";
  if (arabic >= latin) return "ar";
  return "en";
}

export function isLikelyLanguageMismatch(
  text: string | undefined,
  preferredLanguage: PreferredLanguage
): boolean {
  const value = (text ?? "").trim();
  if (!value) return false;

  const hasArabic = hasArabicChars(value);
  const hasLatin = hasLatinChars(value);
  if (preferredLanguage === "ar") return !hasArabic && hasLatin;
  return !hasLatin && hasArabic;
}

export function languageGuardFallback(preferredLanguage: PreferredLanguage): string {
  if (preferredLanguage === "ar") {
    return "أبشر، بحثت لك عن أفضل الخيارات المتاحة الآن. إذا تبي، أقدر أعرض لك تفاصيل أكثر حسب ميزانيتك والموقع.";
  }
  return "Sure, I searched for the best available options for you. If you want, I can refine results by your budget and location.";
}
