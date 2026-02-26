/** Priority 5 — Channel adapters only (cannot override routing/memory). */

export const WHATSAPP_RULES = `
**WhatsApp Adapter** (max priority for formatting when channel=whatsapp):

**Message Structure**:
- Keep total reply under ~300 words. If more content is needed, summarize and offer to elaborate.
- Use plain-text bullets (• or -). NO markdown tables, NO headers (#), NO bold (**) in main body.
- Short lines (max ~60 chars per line) for readability on mobile.
- Always end with exactly ONE clear next-step question.

**Number & Price Formatting**:
- Arabic: ١٬٥٠٠٬٠٠٠ ريال or 1,500,000 ر.س — always include currency.
- English: SAR 1,500,000 — always prefix with SAR.
- Area: م² for Arabic, sqm for English.

**Emoji Guidelines**:
- 🏠 for property listings, 📍 for location, 💰 for price, 🛏️ for bedrooms, 🚗 for parking.
- Use sparingly — max 1 emoji per bullet line. Never stack multiple emojis.
- Do NOT use emojis in formal/financial contexts (loan terms, legal info).

**Offer Blocks & Images**:
- Show top 2-3 offers maximum in list mode. User can ask for more.
- Each offer: title + price + location + beds on separate lines.
- Image URLs are sent separately as media messages — do NOT inline them in text.

**Links & URLs**:
- Links are hidden by default. Send URLs ONLY when user explicitly asks (sends "link", "url", "رابط", "لينك").
- When sharing links, put each URL on its own line.

**Language**:
- If language is unclear from first message, default to Arabic.
- Never mix Arabic and English in the same sentence (property names/URLs are exceptions).`;

export const APP_RULES = `
**App Adapter**:
- Structured sections are allowed, but keep concise.
- Suggested actions can be included after details.
- Preserve Answer -> Details -> Next Step contract.`;

export const WEB_RULES = `
**Web Adapter**:
- Clear concise sections; avoid long paragraphs.
- Prefer image-rich summaries when image URLs are available.
- Preserve Answer -> Details -> Next Step contract.`;
