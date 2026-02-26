import type { SuggestedAction, WhatsAppResponseMode } from "../constants";
import { WA_LINE_MAX_CHARS, WA_MAX_LINES } from "../constants";

export type QuickReplyIntent = {
  normalizedMessage: string;
  intent:
    | "none"
    | "more_options"
    | "details_k"
    | "compare_top"
    | "speak_to_agent"
    | "adjust_budget";
};

export function detectArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function compactLine(input: string, max = WA_LINE_MAX_CHARS): string {
  const line = input.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function ensureSingleQuestion(text: string, isArabic: boolean): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const existingQuestion = lines.find((line) => /[؟?]/.test(line));
  const nextQuestion = isArabic
    ? "تحب أعرض لك الخطوة الجاية الآن؟"
    : "Would you like me to take the next step now?";
  const body = lines.filter((line) => !/[؟?]/.test(line));
  body.push(existingQuestion ? compactLine(existingQuestion, 140) : nextQuestion);
  return body.slice(0, WA_MAX_LINES).join("\n");
}

export function enforceWhatsAppMessageContract(text: string): string {
  const isArabic = detectArabic(text);
  const normalized = text
    .split("\n")
    .map((line) => compactLine(line))
    .filter(Boolean)
    .slice(0, WA_MAX_LINES)
    .join("\n");
  return ensureSingleQuestion(normalized, isArabic);
}

export function buildContextAwareCta(params: {
  text: string;
  responseMode: WhatsAppResponseMode;
  suggestedActions?: SuggestedAction[];
}): string {
  const { text, responseMode, suggestedActions } = params;
  const isArabic = detectArabic(text);
  const firstAction = suggestedActions?.find((action) => action.label?.trim());
  if (firstAction) return compactLine(firstAction.label, 90);
  if (responseMode === "single_property_detail") {
    return isArabic
      ? "تحب موعد معاينة أو خيارات مشابهة؟"
      : "Want a viewing booking or similar options?";
  }
  if (responseMode === "search_list") {
    return isArabic
      ? "أرسل رقم العرض (1/2/3) للتفاصيل أو اكتب: قارن بينهم."
      : "Reply with offer number (1/2/3) for details, or say: compare.";
  }
  return isArabic ? "تحب أكمل بالخطوة التالية؟" : "Should I continue with the next step?";
}

export function parseQuickReplyIntent(input: string): QuickReplyIntent {
  const text = input.trim();
  if (!text) return { intent: "none", normalizedMessage: text };
  const lower = text.toLowerCase();
  const detailsMatch = lower.match(/^#?\s*([1-9])$/);
  if (detailsMatch?.[1]) {
    return {
      intent: "details_k",
      normalizedMessage: `تفاصيل عن #${detailsMatch[1]}`,
    };
  }
  if (/\b(more|another|next options|more options)\b/i.test(lower) || /خيارات|أكثر|غيرها|زيادة/.test(text)) {
    return { intent: "more_options", normalizedMessage: "خيارات أكثر" };
  }
  if (/\b(compare|comparison)\b/i.test(lower) || /قارن|مقارنة/.test(text)) {
    return { intent: "compare_top", normalizedMessage: "قارن أفضل 3 خيارات" };
  }
  if (/\b(agent|human|sales|call me)\b/i.test(lower) || /وسيط|موظف|مندوب|فريق المبيعات/.test(text)) {
    return { intent: "speak_to_agent", normalizedMessage: "أبغى أكلم وسيط" };
  }
  if (/\bbudget|price range|cheaper\b/i.test(lower) || /ميزاني|السعر|أرخص/.test(text)) {
    return { intent: "adjust_budget", normalizedMessage: "أبغى خيارات ضمن ميزانية مختلفة" };
  }
  return { intent: "none", normalizedMessage: text };
}

export function parseVoiceConfirmationDecision(text: string): {
  decision: "confirm" | "correct" | "none";
  correctedText?: string;
} {
  const trimmed = text.trim();
  if (!trimmed) return { decision: "none" };
  const normalized = trimmed
    .replace(/[،,.!?؟]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
  const startsWithAny = (candidates: string[]) =>
    candidates.some((candidate) => normalized === candidate || normalized.startsWith(`${candidate} `));
  if (
    startsWithAny([
      "yes",
      "yup",
      "correct",
      "ok",
      "okay",
      "نعم",
      "ايوه",
      "ايوا",
      "صح",
      "تمام",
      "كمل",
      "أكمل",
    ])
  ) {
    return { decision: "confirm" };
  }
  const correctionPrefix = /^(edit|change|no|تعديل|عدّل|لا|مو كذا|خطأ)\s*[:-]?\s*/i;
  if (correctionPrefix.test(trimmed)) {
    const correctedText = trimmed.replace(correctionPrefix, "").trim();
    return { decision: "correct", correctedText: correctedText || undefined };
  }
  return { decision: "none" };
}
