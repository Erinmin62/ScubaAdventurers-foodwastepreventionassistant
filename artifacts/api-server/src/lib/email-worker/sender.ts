import type { EmailProviderConfig } from "./config";
import type { EmailMessage } from "./rules";

export type SendResult =
  | { status: "accepted"; providerId: string }
  | { status: "failed" | "uncertain"; errorCode: string; errorDetail: string };
export type EmailSender = (id: string, recipient: string, message: EmailMessage) => Promise<SendResult>;

/** Fixed HTTPS origin; never log request headers, recipient, or raw provider payloads. */
export function resendSender(config: EmailProviderConfig, request: typeof fetch = fetch): EmailSender {
  return async (id, recipient, message) => {
    try {
      const response = await request("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json",
          "Idempotency-Key": `expiryguard-email/${id}`,
        },
        body: JSON.stringify({ from: config.from, to: [recipient], subject: message.subject, text: message.text }),
        signal: AbortSignal.timeout(15_000),
        redirect: "error",
      });
      if (!response.ok) {
        // A timeout, conflict or server error could have been processed. Never blindly resend it.
        const ambiguous = response.status >= 500 || [408, 409, 425].includes(response.status);
        return {
          status: ambiguous ? "uncertain" : "failed",
          errorCode: `provider_http_${response.status}`,
          errorDetail: ambiguous ? "Provider acceptance is unknown; check the provider before any retry."
            : "Provider rejected this attempt; correct configuration and review before an explicit retry.",
        };
      }
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !("id" in data) || typeof data.id !== "string" || data.id.length > 200) {
        return { status: "uncertain", errorCode: "invalid_provider_receipt", errorDetail: "Provider response did not confirm an email ID; do not retry automatically." };
      }
      return { status: "accepted", providerId: data.id };
    } catch {
      return { status: "uncertain", errorCode: "provider_request_interrupted", errorDetail: "Request failed or timed out; acceptance is unknown. Do not retry automatically." };
    }
  };
}
