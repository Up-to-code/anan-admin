/**
 * Re-export WhatsApp API for backward compatibility.
 * Primary implementation: convex/channels/whatsapp/api.ts
 */
export {
  extractWebhookEvents,
  extractAllWebhookEvents,
  verifyWhatsAppSignature,
  markMessageAsRead,
  sendTypingIndicator,
  sendWhatsAppMessage,
  sendWhatsAppImage,
  sendWhatsAppTextWithImage,
  sendWhatsAppTemplate,
  type ExtractedTextMessage,
  type ExtractedReactionEvent,
  type ExtractedMessageMediaType,
  type WhatsAppTemplateComponent,
  type WhatsAppTemplateComponents,
} from "../channels/whatsapp/api";
