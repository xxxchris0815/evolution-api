import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import axios from 'axios';

import { TemplateController } from '../../src/api/controllers/template.controller';
import { MetaWebhookConfigService } from '../../src/api/services/metaWebhookConfig.service';
import { TemplateService } from '../../src/api/services/template.service';

describe('TemplateController (unit)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('delegates create/find/edit/delete/status operations to service', async () => {
    const service = {
      create: mock.fn(async () => ({ id: 'local-1' })),
      find: mock.fn(async () => ({ data: [] })),
      findById: mock.fn(async () => ({ id: '123', status: 'APPROVED' })),
      edit: mock.fn(async () => ({ success: true })),
      delete: mock.fn(async () => ({ success: true })),
    } as unknown as TemplateService;

    const metaWebhookConfigService = {
      find: mock.fn(async () => ({ callbackUrl: 'http://localhost/webhook/meta' })),
      update: mock.fn(async () => ({ passthroughEnabled: true })),
    } as unknown as MetaWebhookConfigService;

    const chatwootSync = {
      sync: mock.fn(async () => ({ metaSynced: 1 })),
    } as any;

    const controller = new TemplateController(service, metaWebhookConfigService, chatwootSync);
    const instance = { instanceName: 'meta-instance' } as any;

    await controller.createTemplate(instance, { name: 'hello' } as any);
    await controller.findTemplate(instance, { status: 'APPROVED' });
    await controller.findTemplateById(instance, { templateId: '123' });
    await controller.findTemplateStatus(instance, { templateId: '123' });
    await controller.editTemplate(instance, { templateId: '123', category: 'UTILITY' });
    await controller.deleteTemplate(instance, { name: 'hello', hsmId: '123' });
    await controller.findMetaWebhookConfig(instance);
    await controller.updateMetaWebhookConfig(instance, { passthroughEnabled: true });

    assert.equal((service.create as any).mock.callCount(), 1);
    assert.equal((service.find as any).mock.callCount(), 1);
    assert.equal((service.findById as any).mock.callCount(), 2);
    assert.equal((service.edit as any).mock.callCount(), 1);
    assert.equal((service.delete as any).mock.callCount(), 1);
    assert.equal((metaWebhookConfigService.find as any).mock.callCount(), 1);
    assert.equal((metaWebhookConfigService.update as any).mock.callCount(), 1);

    const statusCall = (service.findById as any).mock.calls[1].arguments[1];
    assert.equal(statusCall.templateId, '123');
    assert.match(statusCall.fields, /status/);
  });
});

describe('TemplateService Graph URL building (unit)', () => {
  it('uses WA_BUSINESS version v26.0 and forwards list filters', async () => {
    const calls: Array<{ url: string; params?: any }> = [];

    mock.method(axios, 'get', async (url: string) => {
      if (String(url).includes('/message_templates')) {
        return { data: { data: [] } };
      }
      return { data: {} };
    });

    const service = new TemplateService(
      {
        waInstances: {
          'meta-instance': {
            instance: {
              id: 'inst-1',
              businessId: 'waba-1',
              number: 'phone-1',
              token: 'token-1',
            },
          },
        },
      } as any,
      {
        instance: {
          update: mock.fn(async () => undefined),
        },
      } as any,
      {
        get: () => ({ URL: 'https://graph.facebook.com', VERSION: 'v26.0' }),
      } as any,
    );

    (service as any).requestTemplate = async (_data: any, method: string, filters: any = {}) => {
      calls.push({
        url: `https://graph.facebook.com/v26.0/waba-1/message_templates`,
        params: method === 'GET' ? filters : undefined,
      });
      return { data: [{ id: '1', name: 'hello', status: 'APPROVED' }] };
    };

    (service as any).requestTemplateById = async (templateId: string, fields: string) => {
      calls.push({ url: `https://graph.facebook.com/v26.0/${templateId}`, params: { fields } });
      return { id: templateId, status: 'PENDING' };
    };

    // Bypass private credential loader side effects by setting fields directly through public methods
    const originalLoad = (service as any).loadInstanceCredentials.bind(service);
    (service as any).loadInstanceCredentials = async (instance: any) => originalLoad(instance);

    const list = await service.find({ instanceName: 'meta-instance' } as any, {
      status: 'APPROVED',
      limit: 10,
      name: 'hello',
    });
    const byId = await service.findById({ instanceName: 'meta-instance' } as any, { templateId: '99' });

    assert.equal(list.data[0].id, '1');
    assert.equal(byId.status, 'PENDING');
    assert.equal(calls[0].url, 'https://graph.facebook.com/v26.0/waba-1/message_templates');
    assert.deepEqual(calls[0].params, { status: 'APPROVED', limit: 10, name: 'hello' });
    assert.equal(calls[1].url, 'https://graph.facebook.com/v26.0/99');
    assert.match(calls[1].params.fields, /status/);
  });
});
