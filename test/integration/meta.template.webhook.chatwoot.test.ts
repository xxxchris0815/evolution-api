import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import { MetaTemplateWebhookService } from '../../src/api/integrations/channel/meta/meta.template.webhook.service';
import { Events } from '../../src/api/types/wa.types';

describe('MetaTemplateWebhookService Chatwoot notify (integration)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('notifies Chatwoot agents when template status webhook is handled', async () => {
    const notifyTemplateStatus = mock.fn(async () => undefined);
    const chatwootService = { notifyTemplateStatus } as any;

    const prismaRepository = {
      template: {
        findFirst: mock.fn(async () => ({
          id: 'local-template',
          templateId: '555',
          name: 'hello_world',
          template: { id: '555', status: 'PENDING' },
          webhookUrl: null,
          Instance: { name: 'meta-instance' },
        })),
        update: mock.fn(async () => ({ id: 'local-template' })),
      },
      instance: { findFirst: mock.fn(async () => null) },
    } as any;

    const waMonitor = {
      waInstances: {
        'meta-instance': { token: 't', wuid: 'w', instanceId: 'inst-1' },
      },
    } as any;

    const configService = {
      get: (key: string) => {
        if (key === 'SERVER') return { URL: 'http://localhost:8080' };
        if (key === 'AUTHENTICATION') return { EXPOSE_IN_FETCH_INSTANCES: false };
        if (key === 'CHATWOOT') return { ENABLED: true };
        return {};
      },
    } as any;

    const emitMock = mock.fn(async () => undefined);
    const service = new MetaTemplateWebhookService(
      prismaRepository,
      waMonitor,
      configService,
      { emit: emitMock } as any,
      chatwootService,
    );

    await service.handle(
      {
        field: 'message_template_status_update',
        value: {
          event: 'REJECTED',
          message_template_id: 555,
          message_template_name: 'hello_world',
          reason: 'INVALID_FORMAT',
        },
      },
      'waba-1',
    );

    assert.equal(emitMock.mock.callCount(), 1);
    assert.equal(emitMock.mock.calls[0].arguments[0].event, Events.TEMPLATE_STATUS_UPDATE);
    assert.equal(notifyTemplateStatus.mock.callCount(), 1);
    assert.equal(notifyTemplateStatus.mock.calls[0].arguments[0].instanceName, 'meta-instance');
    assert.equal(notifyTemplateStatus.mock.calls[0].arguments[1].event, 'REJECTED');
  });
});
