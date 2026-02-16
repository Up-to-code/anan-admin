/**
 * Channel-specific rules: WhatsApp, App, Web.
 */

export const WHATSAPP_RULES = `
**WhatsApp channel**:
- Keep replies concise (under ~300 words) and action-first (answer first, then brief details).
- Use bullet-only plain text formatting; no markdown tables and no long multi-section formatting.
- Use short lines and compact list items.
- Emojis sparingly.
- If language is unclear, default to Arabic.
- Do not include links by default; only provide URLs when the user explicitly asks for links.
- **WhatsApp offer priority**: For each offer card, order of information: image first (multiple photos when available so the user can see the property clearly—do not summarize to a single image when more are provided), then price, location, bedrooms, bathrooms, area, then one key line of description (no long paragraphs). Keep each offer to a few bullet lines; show 2–3 offers per message when available.
- Prioritize image-with-caption offer cards. Each offer should focus on one property with concise details (title, price, location, key feature).`;

export const APP_RULES = `
**App channel**: You can use richer formatting. Structured data and longer explanations are fine.`;

export const WEB_RULES = `
**Web channel**:
- Prefer concise but informative responses with clear structure.
- Use short sections or bullets when helpful.
- Keep links optional; include URLs only when the user asks or when needed for next action.
- When sharing property options, prioritize image-rich summaries when image URLs are available.`;
