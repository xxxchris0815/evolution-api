import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import { MetaWebhookPassthroughService } from '../../src/api/integrations/channel/meta/meta.webhook.passthrough.service';
import { Events } from '../../src/api/types/wa.types';

describe('MetaWebhookPassthroughService (integration)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('forwards Meta schema payload to matching instance by phone_number_id', async () => {
    const prismaRepository = {
      instance: {
        findFirst: mock.fn(async () => ({ name: 'meta-instance', number: 'phone-1' })),
        findMany: mock.fn(async () => []),
        findUnique: mock.fn(async () => ({ Setting: { metaWebhookPassthrough: false } })),
      },
    } as any;

    const emitMock = mock.fn(async () => undefined);
    const service = new MetaWebhookPassthroughService(
      prismaRepository,
      { waInstances: { 'meta-instance': { token: 't', wuid: 'w' } } } as any,
      {
        get: (key: string) => {
          if (key === 'SERVER') return { URL: 'http://localhost:8080' };
          if (key === 'AUTHENTICATION') return { EXPOSE_IN_FETCH_INSTANCES: false };
          if (key === 'WA_BUSINESS') return { WEBHOOK_PASSTHROUGH: false };
          return {};
        },
      } as any,
      { emit: emitMock } as any,
    );

    const metaBody = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-1',
          changes: [
            {
              field: 'account_update',
              value: {
                event: 'ACCOUNT_VIOLATION',
                metadata: { phone_number_id: 'phone-1' },
              },
            },
          ],
        },
      ],
    };

    const delivered = await service.forward(metaBody, 'dedicated');

    assert.equal(delivered, 1);
    assert.equal(emitMock.mock.callCount(), 1);
    const payload = emitMock.mock.calls[0].arguments[0];
    assert.equal(payload.event, Events.META_WEBHOOK);
    assert.equal(payload.instanceName, 'meta-instance');
    assert.equal(payload.data.object, 'whatsapp_business_account');
    assert.equal(payload.data.entry[0].changes[0].field, 'account_update');
    assert.equal(payload.data._evolution.mode, 'dedicated');
  });

  it('resolves instances by WABA/businessId when phone_number_id is missing', async () => {
    const prismaRepository = {
      instance: {
        findFirst: mock.fn(async () => null),
        findMany: mock.fn(async () => [{ name: 'waba-instance', businessId: 'waba-9' }]),
        findUnique: mock.fn(async () => ({ Setting: { metaWebhookPassthrough: true } })),
      },
    } as any;

    const emitMock = mock.fn(async () => undefined);
    const service = new MetaWebhookPassthroughService(
      prismaRepository,
      { waInstances: { 'waba-instance': { token: 't', wuid: 'w' } } } as any,
      {
        get: (key: string) => {
          if (key === 'SERVER') return { URL: 'http://localhost:8080' };
          if (key === 'AUTHENTICATION') return { EXPOSE_IN_FETCH_INSTANCES: false };
          if (key === 'WA_BUSINESS') return { WEBHOOK_PASSTHROUGH: false };
          return {};
        },
      } as any,
      { emit: emitMock } as any,
    );

    const delivered = await service.forward(
      {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-9',
            changes: [
              {
                field: 'business_capability_update',
                value: { max_daily_conversation_per_phone: 1000 },
              },
            ],
          },
        ],
      },
      'sidecar',
    );

    assert.equal(delivered, 1);
    assert.equal(emitMock.mock.calls[0].arguments[0].data._evolution.mode, 'sidecar');
    assert.equal(emitMock.mock.calls[0].arguments[0].data.entry[0].changes[0].field, 'business_capability_update');
  });

  it('skips sidecar delivery when instance passthrough is disabled', async () => {
    const prismaRepository = {
      instance: {
        findFirst: mock.fn(async () => ({ name: 'meta-instance', number: 'phone-1' })),
        findMany: mock.fn(async () => []),
        findUnique: mock.fn(async () => ({ Setting: { metaWebhookPassthrough: false } })),
      },
    } as any;

    const emitMock = mock.fn(async () => undefined);
    const service = new MetaWebhookPassthroughService(
      prismaRepository,
      { waInstances: { 'meta-instance': { token: 't', wuid: 'w' } } } as any,
      {
        get: (key: string) => {
          if (key === 'SERVER') return { URL: 'http://localhost:8080' };
          if (key === 'AUTHENTICATION') return { EXPOSE_IN_FETCH_INSTANCES: false };
          if (key === 'WA_BUSINESS') return { WEBHOOK_PASSTHROUGH: false };
          return {};
        },
      } as any,
      { emit: emitMock } as any,
    );

    const delivered = await service.forward(
      {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba-1',
            changes: [
              {
                field: 'account_update',
                value: { metadata: { phone_number_id: 'phone-1' } },
              },
            ],
          },
        ],
      },
      'sidecar',
    );

    assert.equal(delivered, 0);
    assert.equal(emitMock.mock.callCount(), 0);
  });
});
