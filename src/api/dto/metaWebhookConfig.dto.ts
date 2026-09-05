export class MetaWebhookConfigDto {
  /**
   * Enable raw Meta webhook passthrough sidecar for this instance
   * (also forward Meta-schema payloads from /webhook/meta).
   */
  passthroughEnabled?: boolean;

  /**
   * Ensure instance outbound webhook includes META_WEBHOOK event.
   */
  enableMetaWebhookEvent?: boolean;

  /**
   * Optional Evolution outbound webhook URL to create/update.
   */
  webhookUrl?: string;

  /**
   * Enable the instance outbound webhook when configuring META_WEBHOOK.
   */
  webhookEnabled?: boolean;
}
