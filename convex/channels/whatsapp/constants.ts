export const WHATSAPP_SEND_GAP_MS = 200;
export const NORMAL_SEARCH_MAX_OFFERS = 3;
export const MAX_NORMAL_MESSAGES_PER_TURN = 3;
export const MAX_SEND_ATTEMPTS = 3;
export const WA_SILENT_RETRY_MAX_ATTEMPTS = 2;
export const WA_SILENT_RETRY_MAX_BUDGET_MS = 4000;
/** Transcription: max retries for transient failures (AssemblyAI upload/server). */
export const TRANSCRIPTION_RETRY_ATTEMPTS = 3;
/** Transcription: base delay ms for exponential backoff between retries. */
export const TRANSCRIPTION_RETRY_BASE_DELAY_MS = 1000;

/** Max chars per line before truncation in WhatsApp responses. WhatsApp allows 4096 total. */
export const WA_LINE_MAX_CHARS = 380;
/** Max lines in a single WhatsApp message (Details + Next Step). */
export const WA_MAX_LINES = 10;


/** Arabic fallback when agent/reply fails or uncaught error. Ensures user always gets a response. */
export const AGENT_FALLBACK_MESSAGE_AR =
  "حالياً في ضغط على الخدمة. حاول مرة ثانية بعد قليل.";

/** Arabic fallback when voice note transcription fails or voice handling errors. */
export const VOICE_FALLBACK_MESSAGE_AR =
  "وصلتني الملاحظة الصوتية لكن ما قدرت أفهمها بالكامل. أرسلها مرة ثانية بشكل أقصر أو اكتب المطلوب.";

export type WhatsAppResponseMode =
  | "search_list"
  | "single_property_detail"
  | "general_info";

export type SuggestedAction = {
  id: string;
  label: string;
  action: string;
  payload?: unknown;
};
