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
  preferredLanguage: PreferredLanguage,
): boolean {
  const value = (text ?? "").trim();
  if (!value) return false;

  const clean = value
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/[0-9\s.,!?;:()"'*_\-–—]/g, "");

  const arabicCount = countArabicChars(clean);
  const latinCount = countLatinChars(clean);

  if (preferredLanguage === "ar") {
    // If user prefers Arabic, but reply is predominantly Latin (> 3x more latin than arabic)
    if (latinCount > 10 && latinCount > arabicCount * 3) return true;
    return arabicCount === 0 && latinCount > 5;
  }
  // If user prefers English, but reply contains ANY Arabic
  return arabicCount > 0;
}

export function languageGuardFallback(preferredLanguage: PreferredLanguage): string {
  if (preferredLanguage === "ar") {
    return `أبشر، بحثت لك هذه الخيارات. (Answer)

- البدائل متاحة حسب ميزانيتك وفي أحياء مختلفة.
- يمكننا حفظ هذه القائمة لك للمتابعة لاحقاً.
- أنا جاهز لمساعدتك بمجرد أن تكون مستعداً للمعاينة. (Details)

ما الخطوة التالية التي تفضل أن أبدأ بها؟ (Next Step)`;
  }
  return `Happy to help! I've found these options for you. (Answer)

- We can look for more alternatives based on your budget and preferred neighborhood.
- If you're not ready now, we can save these and follow up later.
- I'm here when you're ready for a viewing or want to proceed with a purchase! (Details)

What would you like to do next? (Next Step)`;
}
