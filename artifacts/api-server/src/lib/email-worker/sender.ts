import type { ProxyOptions } from "@replit/connectors-sdk";
import type { EmailProviderConfig } from "./config";
import type { EmailMessage } from "./rules";

export type SendResult =
  | { status: "accepted"; providerId: string }
  | { status: "failed" | "uncertain"; errorCode: string; errorDetail: string };
export type EmailSender = (id: string, recipient: string, message: EmailMessage) => Promise<SendResult>;

function classifyResponse(response: Response): Promise<SendResult> {
  if (!response.ok) {
    // A timeout, conflict or server error could have been processed. Never blindly resend it.
    const ambiguous = response.status >= 500 || [408, 409, 425].includes(response.status);
    return Promise.resolve({
      status: ambiguous ? "uncertain" : "failed",
      errorCode: `provider_http_${response.status}`,
      errorDetail: ambiguous ? "Provider acceptance is unknown; check the provider before any retry."
        : "Provider rejected this attempt; correct configuration and review before an explicit retry.",
    });
  }
  return response.json().then((data: unknown) => {
    if (!data || typeof data !== "object" || !("id" in data) || typeof data.id !== "string" || data.id.length > 200) {
      return { status: "uncertain", errorCode: "invalid_provider_receipt", errorDetail: "Provider response did not confirm an email ID; do not retry automatically." } as const;
    }
    return { status: "accepted", providerId: data.id } as const;
  }).catch(() => ({
    status: "uncertain", errorCode: "invalid_provider_receipt",
    errorDetail: "Provider response did not confirm an email ID; do not retry automatically.",
  }));
}

/** Fixed HTTPS origin; never log request headers, recipient, or raw provider payloads. */
export function resendSender(config: EmailProviderConfig & { apiKey: string }, request: typeof fetch = fetch): EmailSender {
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
      return await classifyResponse(response);
    } catch {
      return { status: "uncertain", errorCode: "provider_request_interrupted", errorDetail: "Request failed or timed out; acceptance is unknown. Do not retry automatically." };
    }
  };
}

/** Uses the Resend connection attached to this Replit project; credentials stay in Replit. */
export function resendConnectorSender(
  config: Pick<EmailProviderConfig, "from">,
  proxy?: (path: string, init?: ProxyOptions) => Promise<Response>,
): EmailSender {
  let connectedRequest: ((path: string, init?: ProxyOptions) => Promise<Response>) | undefined;
  const request = proxy ?? (async (path: string, init?: ProxyOptions) => {
    if (!connectedRequest) {
      const { ReplitConnectors } = await import("@replit/connectors-sdk");
      const connectors = new ReplitConnectors();
      connectedRequest = (requestPath, options) => connectors.proxy("resend", requestPath, options);
    }
    return connectedRequest(path, init);
  });
  return async (id, recipient, message) => {
    try {
      const response = await request("/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `expiryguard-email/${id}`,
        },
        body: JSON.stringify({ from: config.from, to: [recipient], subject: message.subject, text: message.text }),
      });
      return await classifyResponse(response);
    } catch {
      return { status: "uncertain", errorCode: "provider_request_interrupted", errorDetail: "Request failed or timed out; acceptance is unknown. Do not retry automatically." };
    }
  };
}
