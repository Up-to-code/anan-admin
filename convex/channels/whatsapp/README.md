# WhatsApp channel (Convex)

How the WhatsApp Cloud API is wired and how to continue extending it.

## Layout

| File | Role |
|------|------|
| **api.ts** | Webhook parsing (`extractWebhookEvents`, `extractAllWebhookEvents`), signature verification, and low-level send helpers (text, image, template). |
| **service.ts** | `WhatsAppService` – send text/image/template with optional 429 retry; used by webhook and auth (OTP). |
| **webhook.ts** | HTTP handler: verify (GET), parse (POST), then OTP or agent reply. |
| **api.test.ts** | Unit tests for webhook payload parsing. |

Backward-compatible re-exports: `convex/lib/whatsapp.ts` → `channels/whatsapp/api.ts`.

## HTTP routes

Defined in `convex/http.ts`:

- **GET** `/api/webhook/whatsapp` – Meta app subscription verification (`hub.mode`, `hub.verify_token`, `hub.challenge`).
- **POST** `/api/webhook/whatsapp` – Incoming messages; signature check, then OTP handling or agent reply.

Set your Meta app webhook URL to:  
`https://<your-convex-domain>/api/webhook/whatsapp`

## Environment variables

Set in Convex dashboard (or `.env.local` for dev):

| Variable | Used by | Purpose |
|----------|---------|---------|
| `WHATSAPP_ACCESS_TOKEN` | api, service, auth | Meta Graph API token. |
| `WHATSAPP_APP_SECRET` | webhook, api | Verify `x-hub-signature-256`. |
| `WHATSAPP_VERIFY_TOKEN` | webhook GET | Custom token for subscription verification. |
| `WHATSAPP_PHONE_NUMBER_ID` | webhook, auth | Default phone number ID for sending. |
| `WHATSAPP_SKIP_VERIFICATION` | webhook | `"true"` to skip signature (dev only). |
| `WHATSAPP_OTP_TEMPLATE_NAME` | auth | Template name for OTP (e.g. `opt_en`). |
| `WHATSAPP_OTP_TEMPLATE_LANG` | auth | Template language (e.g. `en_US`). |
| `WHATSAPP_OTP_TEMPLATE_COPY_CODE` | auth | `"true"` if template has copy-code button. |
| `WHATSAPP_OTP_RATE_LIMIT` | auth | Max OTPs per window (default `1`). |
| `WHATSAPP_OTP_RATE_WINDOW_SEC` | auth | Rate window in seconds (default `60`). |
| `WHATSAPP_BUSINESS_NUMBER` / `WHATSAPP_PHONE_NUMBER` | auth | For “Chat on WhatsApp” link. |

## Message flow (POST webhook)

1. **Verify** – `x-hub-signature-256` with `WHATSAPP_APP_SECRET` (unless `WHATSAPP_SKIP_VERIFICATION=true`).
2. **Parse** – `extractAllWebhookEvents(body)` → `messages` and `reactions`.
3. **Reactions** – Mark message as read.
4. **Per message:**
   - Mark as read, optional typing indicator.
   - If body looks like OTP (`isOtpLike`) → `internal.features.auth.actions.completeVerification`; send success/error in Arabic.
   - Else → ensure user via `api.services.users.ensureWhatsAppUser`, then `internal.agents.actions.generateReplyAndReturnText` with `channel: "whatsapp"`, send text or text+image.

## Continuing / extending

- **New message types** – In `webhook.ts`, add logic before or after the OTP/agent block (e.g. commands, quick replies).
- **New templates** – Use `WhatsAppService.sendTemplateWithComponents()` (auth already uses it for OTP). Define templates in Meta Business Manager.
- **Standalone send** – Import `WhatsAppService` from `channels/whatsapp/service` or use `lib/whatsapp` helpers (`sendWhatsAppMessage`, `sendWhatsAppTemplate`, etc.).
- **Tests** – Add cases in `api.test.ts` for new payload shapes; run with `bun test convex/channels/whatsapp/api.test.ts`.

Agent behavior for WhatsApp (shorter replies, no markdown links) is in `convex/agents/anan/instructions.ts` (`WHATSAPP_RULES`).
