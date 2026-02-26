/**
 * WhatsApp channel message templates for lead text and offer introductions.
 * Centralised here for easy editing and A/B testing.
 */

export const WHATSAPP_LEAD_TEXT = {
    ar: {
        freshSearch:
            "أبشر، لقيت لك خيارات مناسبة ومفصلة. شوف العروض والصور واختر الأنسب لك:",
        followUp:
            "أبشر، هذه خيارات إضافية حسب طلبك. شوف الصور والتفاصيل واختار الأنسب:",
    },
    en: {
        freshSearch:
            "I got this for you with specific matching options and details. Check the offers and images below:",
        followUp:
            "Great, here are additional options based on your last search. Check the offers and images below:",
    },
} as const;

export function getWhatsAppLeadText(params: {
    preferredLanguage: "ar" | "en";
    isFollowUp: boolean;
}): string {
    const lang = params.preferredLanguage;
    return params.isFollowUp
        ? WHATSAPP_LEAD_TEXT[lang].followUp
        : WHATSAPP_LEAD_TEXT[lang].freshSearch;
}
