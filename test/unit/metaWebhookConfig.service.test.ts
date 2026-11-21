import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import { MetaWebhookConfigService } from '../../src/api/services/metaWebhookConfig.service';

describe('MetaWebhookConfigService (unit)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('returns callback URLs, verify token and passthrough flags', async () => {
    const prismaRepository = {
      instance: {
        findUnique: mock.fn(async () => ({
          id: 'inst-1',
          name: 'meta-instance',
          integration: 'WHATSAPP-BUSINESS',
          Setting: { metaWebhookPassthrough: true },
          Webhook: {
            enabled: true,
            url: 'https://hooks.example/meta',
            events: ['MESSAGES_UPSERT', 'META_WEBHOOK'],
          },
        })),
      },
    } as any;

    const service = new MetaWebhookConfigService(
      { waInstances: {} } as any,
      prismaRepository,
      {
        get: (key: string) => {
          if (key === 'SERVER') return { URL: 'https://api.example/' };
          if (key === 'WA_BUSINESS') return { TOKEN_WEBHOOK: 'verify-token', WEBHOOK_PASSTHROUGH: false };
          return {};
        },
      } as any,
    );

    const result = await service.find({ instanceName: 'meta-instance' } as any);

    assert.equal(result.callbackUrl, 'https://api.example/webhook/meta');
    assert.equal(result.passthroughUrl, 'https://api.example/webhook/meta/passthrough');
    assert.equal(result.verifyToken, 'verify-token');
    assert.equal(result.passthroughEnabled, true);
    assert.equal(result.metaWebhookEventEnabled, true);
    assert.equal(result.webhookUrl, 'https://hooks.example/meta');
  });

  it('upserts setting and webhook when activating META_WEBHOOK', async () => {
    const settingUpsert = mock.fn(async () => undefined);
    const webhookUpsert = mock.fn(async () => undefined);

    const prismaRepository = {
      instance: {
        findUnique: mock.fn(async () => ({
          id: 'inst-1',
          name: 'meta-instance',
          integration: 'WHATSAPP-BUSINESS',
          Setting: { metaWebhookPassthrough: false },
          Webhook: null,
        })),
      },
      setting: { upsert: settingUpsert },
      webhook: { upsert: webhookUpsert },
    } as any;

    const service = new MetaWebhookConfigService(
      { waInstances: { 'meta-instance': { localSettings: {}, localWebhook: {} } } } as any,
      prismaRepository,
      {
        get: (key: string) => {
          if (key === 'SERVER') return { URL: 'https://api.example' };
          if (key === 'WA_BUSINESS') return { TOKEN_WEBHOOK: 'verify-token', WEBHOOK_PASSTHROUGH: false };
          return {};
        },
      } as any,
    );

    await service.update({ instanceName: 'meta-instance' } as any, {
      passthroughEnabled: true,
      enableMetaWebhookEvent: true,
      webhookUrl: 'https://hooks.example/meta',
      webhookEnabled: true,
    });

    assert.equal(settingUpsert.mock.callCount(), 1);
    assert.equal(settingUpsert.mock.calls[0].arguments[0].update.metaWebhookPassthrough, true);
    assert.equal(webhookUpsert.mock.callCount(), 1);
    assert.deepEqual(webhookUpsert.mock.calls[0].arguments[0].create.events, ['META_WEBHOOK']);
  });

  it('removes META_WEBHOOK from events when disabling without requiring a new URL', async () => {
    const webhookUpsert = mock.fn(async () => undefined);

    const prismaRepository = {
      instance: {
        findUnique: mock.fn(async () => ({
          id: 'inst-1',
          name: 'meta-instance',
          integration: 'WHATSAPP-BUSINESS',
          Setting: { metaWebhookPassthrough: true },
          Webhook: {
            enabled: true,
            url: 'https://hooks.example/meta',
            events: ['MESSAGES_UPSERT', 'META_WEBHOOK'],
          },
        })),
      },
      setting: { upsert: mock.fn(async () => undefined) },
      webhook: { upsert: webhookUpsert },
    } as any;

    const service = new MetaWebhookConfigService(
      { waInstances: {} } as any,
      prismaRepository,
      {
        get: (key: string) => {
          if (key === 'SERVER') return { URL: 'https://api.example' };
          if (key === 'WA_BUSINESS') return { TOKEN_WEBHOOK: 'verify-token', WEBHOOK_PASSTHROUGH: false };
          return {};
        },
      } as any,
    );

    await service.update({ instanceName: 'meta-instance' } as any, {
      enableMetaWebhookEvent: false,
    });

    assert.equal(webhookUpsert.mock.callCount(), 1);
    assert.deepEqual(webhookUpsert.mock.calls[0].arguments[0].update.events, ['MESSAGES_UPSERT']);
  });
});
