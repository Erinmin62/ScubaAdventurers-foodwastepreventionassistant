import { z } from "zod";
import { hash } from "./rules";

export type EmailRoute = { workspaceId: string; recipient: string; recipientHash: string };
export type EmailProviderConfig = { apiKey?: string; from: string };
export function emailRoutes(env: NodeJS.ProcessEnv): EmailRoute[] {
  if (env.EMAIL_TEST_MODE !== undefined && !["true", "false"].includes(env.EMAIL_TEST_MODE)) {
    throw new Error("invalid_email_test_configuration");
  }
  if (env.EMAIL_TEST_MODE === "true") {
    const testConfig = z.object({
      workspaceId: z.string().regex(/^owner:[A-Za-z0-9_-]+$/),
      recipient: z.string().trim().email().max(254),
    }).safeParse({
      workspaceId: env.EMAIL_TEST_WORKSPACE_ID,
      recipient: env.TEST_EMAIL,
    });
    if (!testConfig.success) throw new Error("invalid_email_test_configuration");
    const recipient = testConfig.data.recipient.toLowerCase();
    return [{
      workspaceId: testConfig.data.workspaceId,
      recipient,
      recipientHash: hash(recipient),
    }];
  }
  if (!env.EMAIL_WORKSPACE_RECIPIENTS_JSON) return [];
  let value: unknown;
  try { value = JSON.parse(env.EMAIL_WORKSPACE_RECIPIENTS_JSON); } catch { throw new Error("invalid_recipient_configuration"); }
  const parsed = z.record(z.string().regex(/^owner:[A-Za-z0-9_-]+$/), z.string().email().max(254)).safeParse(value);
  if (!parsed.success) throw new Error("invalid_recipient_configuration");
  return Object.entries(parsed.data).map(([workspaceId, address]) => {
    const recipient = address.trim().toLowerCase();
    return { workspaceId, recipient, recipientHash: hash(recipient) };
  });
}
export function providerConfig(env: NodeJS.ProcessEnv): EmailProviderConfig {
  if (env.EMAIL_NOTIFICATIONS_ENABLED !== "true") throw new Error("email_sending_disabled");
  if (!z.string().email().safeParse(env.EMAIL_FROM).success) throw new Error("email_provider_not_configured");
  const apiKey = env.RESEND_API_KEY?.trim();
  return { ...(apiKey ? { apiKey } : {}), from: env.EMAIL_FROM! };
}
