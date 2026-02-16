/**
 * Shared constants for agent tools and search.
 * Single source of truth; no agent-specific logic.
 */

export const PROVIDER_BRAND_PATTERNS: RegExp[] = [
  /\bgoogle\b/gi,
  /\bserper\b/gi,
  /\bbrowserbase\b/gi,
  /\bstagehand\b/gi,
];

/** Non-property domains to filter out */
export const BLOCKED_DOMAINS = [
  "youtube.com",
  "facebook.com",
  "twitter.com",
  "instagram.com",
  "tiktok.com",
  "linkedin.com",
  "wikipedia.org",
  "reddit.com",
  "pinterest.com",
  "news.google.com",
];

/** Property-related keywords for scoring relevance */
export const PROPERTY_KEYWORDS = [
  "property",
  "villa",
  "apartment",
  "flat",
  "house",
  "home",
  "bedroom",
  "bed",
  "bath",
  "sqm",
  "sqft",
  "price",
  "sar",
  "rent",
  "sale",
  "buy",
  "for sale",
  "listing",
  "real estate",
  "residential",
  "compound",
  "duplex",
  "penthouse",
  "عقار",
  "فيلا",
  "شقة",
  "منزل",
  "بيت",
  "غرف",
  "غرفة",
  "حمام",
  "متر",
  "سعر",
  "ريال",
  "إيجار",
  "بيع",
  "للبيع",
  "للإيجار",
  "سكني",
  "مجمع",
];

/** Saudi cities for location-aware search */
export const SAUDI_CITIES = [
  "riyadh",
  "الرياض",
  "jeddah",
  "جدة",
  "جده",
  "dammam",
  "الدمام",
  "mecca",
  "مكة",
  "medina",
  "المدينة",
  "khobar",
  "الخبر",
  "tabuk",
  "تبوك",
  "abha",
  "أبها",
  "taif",
  "الطائف",
  "jubail",
  "الجبيل",
  "yanbu",
  "ينبع",
  "dhahran",
  "الظهران",
];

/** Search cache TTL: 15 minutes. Kept for backward compat. */
export const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;

/** Three-tier property cache TTLs */
export const SEARCH_CACHE_TTL_HOT_MS = 15 * 60 * 1000; // 15 min
export const SEARCH_CACHE_TTL_WARM_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
export const SEARCH_CACHE_TTL_COLD_MS = 15 * 24 * 60 * 60 * 1000; // 15 days
/** Evict records older than this */
export const SEARCH_CACHE_EVICT_AFTER_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

/** Max listing pages to crawl per provider (stop when 0 cards or circuit breaker) */
export const PORTAL_MAX_PAGES = 5;

/** Approx items per listing page for portal extraction */
export const PORTAL_CARDS_PER_PAGE = 15;

/** Preferred property portals for Saudi Arabia and Dubai */
export const PREFERRED_PROPERTY_SOURCE_DOMAINS: string[] = [
  "wasalt.sa",
  "bayut.sa",
  "propertyfinder.sa",
  "aqar.forsale",
  "sa.aqar.forsale",
  "opensooq.com",
  "olx.com.sa",
  "haraj.com.sa",
  "mubawab.sa",
  "realestate.sa",
  "sakan.sa",
  "eqarat.com",
  "morgans.sa",
  "luxuryhomes.sa",
  "jareed.sa",
  "bayut.com",
  "propertyfinder.ae",
  "dubizzle.com",
  "betterhomes.ae",
  "bhomes.com",
  "propsearch.ae",
  "justproperty.com",
  "zoomproperty.com",
  "luxuryhomes.ae",
];

export const TOP_SOURCE_LIMIT = 3;
export const TOP_CARDS_PER_SOURCE_LIMIT = 3;
export const TOP_CARDS_PER_SOURCE = TOP_CARDS_PER_SOURCE_LIMIT;
export const MIN_CONFIDENCE_FOR_USER = 0.4;
export const PARALLEL_DETAIL_BATCH = 3;
export const SEARCH_CIRCUIT_BREAKER_MS = 8000;
