import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import { MetaTemplateWebhookService } from '../../src/api/integrations/channel/meta/meta.template.webhook.service';
import { Events } from '../../src/api/types/wa.types';

describe('MetaTemplateWebhookService (integration)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('persists template status updates and emits TEMPLATE_STATUS_UPDATE', async () => {
    const templateUpdate = mock.fn(async () => ({ id: 'local-template' }));
    const findFirstTemplate = mock.fn(async () => ({
      id: 'local-template',
      templateId: '555',
      name: 'hello_world',
      template: { id: '555', status: 'PENDING' },
      webhookUrl: null,
      Instance: { name: 'meta-instance' },
    }));

    const prismaRepository = {
      template: {
        findFirst: findFirstTemplate,
        update: templateUpdate,
      },
      instance: {
        findFirst: mock.fn(async () => null),
      },
    } as any;

    const waMonitor = {
      waInstances: {
        'meta-instance': {
          token: 'instance-token',
          wuid: '5511999999999',
        },
      },
    } as any;

    const configService = {
      get: (key: string) => {
        if (key === 'SERVER') return { URL: 'http://localhost:8080' };
        if (key === 'AUTHENTICATION') return { EXPOSE_IN_FETCH_INSTANCES: false };
        return {};
      },
    } as any;

    const emitMock = mock.fn(async () => undefined);
    const eventManager = { emit: emitMock } as any;

    const service = new MetaTemplateWebhookService(prismaRepository, waMonitor, configService, eventManager);

    await service.handle(
      {
        field: 'message_template_status_update',
        value: {
          event: 'APPROVED',
          message_template_id: 555,
          message_template_name: 'hello_world',
          message_template_language: 'en_US',
          reason: null,
        },
      },
      'waba-1',
    );

    assert.equal(templateUpdate.mock.callCount(), 1);
    assert.equal(emitMock.mock.callCount(), 1);

    const emitPayload = emitMock.mock.calls[0].arguments[0];
    assert.equal(emitPayload.instanceName, 'meta-instance');
    assert.equal(emitPayload.event, Events.TEMPLATE_STATUS_UPDATE);
    assert.equal(emitPayload.data.event, 'APPROVED');
    assert.equal(emitPayload.data.message_template_id, 555);

    const updateData = templateUpdate.mock.calls[0].arguments[0].data.template;
    assert.equal(updateData.status, 'APPROVED');
  });

  it('falls back to businessId instance mapping when local template is missing', async () => {
    const prismaRepository = {
      template: {
        findFirst: mock.fn(async () => null),
        update: mock.fn(async () => null),
      },
      instance: {
        findFirst: mock.fn(async () => ({ name: 'fallback-instance', businessId: 'waba-9' })),
      },
    } as any;

    const waMonitor = {
      waInstances: {
        'fallback-instance': {
          token: 'token',
          wuid: 'wuid',
        },
      },
    } as any;

    const configService = {
      get: (key: string) => {
        if (key === 'SERVER') return { URL: 'http://localhost:8080' };
        if (key === 'AUTHENTICATION') return { EXPOSE_IN_FETCH_INSTANCES: false };
        return {};
      },
    } as any;

    const emitMock = mock.fn(async () => undefined);
    const eventManager = { emit: emitMock } as any;

    const service = new MetaTemplateWebhookService(prismaRepository, waMonitor, configService, eventManager);

    await service.handle(
      {
        field: 'message_template_quality_update',
        value: {
          message_template_id: 777,
          message_template_name: 'promo',
          message_template_quality: 'GREEN',
        },
      },
      'waba-9',
    );

    assert.equal(emitMock.mock.callCount(), 1);
    assert.equal(emitMock.mock.calls[0].arguments[0].event, Events.TEMPLATE_QUALITY_UPDATE);
    assert.equal(emitMock.mock.calls[0].arguments[0].instanceName, 'fallback-instance');
  });
});
