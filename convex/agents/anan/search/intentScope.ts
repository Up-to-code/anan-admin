import type { SearchIntent, SearchScope } from "./orchestrationTypes";

const LOAN_PATTERNS = /(?:loan|mortgage|finance|financing|قرض|تمويل|رهن)/i;
const MARKET_PATTERNS =
  /(?:market|trend|regulation|rates|neighborhood|news|سوق|اتجاه|نظام|لائحة|حي|اسعار)/i;
const UAE_PATTERNS =
  /(?:uae|united arab emirates|dubai|abu dhabi|sharjah|ajman|الإمارات|دبي|أبوظبي|الشارقة|عجمان)/i;
const SAUDI_PATTERNS =
  /(?:saudi|riyadh|jeddah|dammam|khobar|mecca|medina|السعود|الرياض|جدة|الدمام|الخبر|مكة|المدينة)/i;

const OBJECTION_PATTERNS =
  /(?:not ready|not now|wait|ليس الآن|غير جاهز|مو جاهز|غالي|expensive|أرخص|cheaper|مختلف|different)/i;
const DETAIL_PATTERNS = /(?:details|info|information|تفاصيل|مزيد|اخبرني|أخبرني)/i;

export function detectSearchIntent(query: string): SearchIntent {
  const q = query.trim();
  if (OBJECTION_PATTERNS.test(q)) return "objection";
  if (DETAIL_PATTERNS.test(q)) return "property_details";
  if (LOAN_PATTERNS.test(q)) return "loan";
  if (MARKET_PATTERNS.test(q)) return "market_info";
  return "property_search";
}

export function detectSearchScope(query: string): SearchScope {
  const q = query.trim();
  const hasUae = UAE_PATTERNS.test(q);
  const hasSaudi = SAUDI_PATTERNS.test(q);
  if (hasUae && !hasSaudi) return "uae";
  if (hasSaudi && !hasUae) return "saudi";
  return "global";
}
