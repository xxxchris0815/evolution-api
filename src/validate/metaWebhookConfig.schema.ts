import { JSONSchema7 } from 'json-schema';
import { v4 } from 'uuid';

export const metaWebhookConfigSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    passthroughEnabled: { type: 'boolean' },
    enableMetaWebhookEvent: { type: 'boolean' },
    webhookUrl: { type: 'string' },
    webhookEnabled: { type: 'boolean' },
  },
};
