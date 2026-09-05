import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import { ChatwootService } from '../../src/api/integrations/chatbot/chatwoot/services/chatwoot.service';
import { buildMetaCannedContent } from '../../src/utils/chatwoot-template.helper';

function buildService(waInstances: Record<string, any>) {
  const cache = {
    has: mock.fn(async () => false),
    get: mock.fn(async () => null),
    set: mock.fn(async () => undefined),
    delete: mock.fn(async () => undefined),
  };

  const service = new ChatwootService(
    { waInstances } as any,
    {
      get: (key: string) => {
        if (key === 'CHATWOOT') return { ENABLED: true, MESSAGE_READ: false };
        if (key === 'SERVER') return { URL: 'http://localhost:8080' };
        return {};
      },
    } as any,
    {
      message: {
        findFirst: mock.fn(async () => null),
        updateMany: mock.fn(async () => ({ count: 0 })),
      },
      $executeRaw: mock.fn(async () => 1),
    } as any,
    cache as any,
  );

  return service;
}

function speedUpWebhookDelay() {
  const realSetTimeout = global.setTimeout;
  mock.method(global, 'setTimeout', ((fn: any, ms?: number, ...args: any[]) => {
    // receiveWebhook waits 500ms; collapse it for tests
    const delay = ms === 500 ? 0 : ms;
    return realSetTimeout(fn, delay as number, ...args);
  }) as typeof setTimeout);
}

describe('ChatwootService template send + notify (integration)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('notifyTemplateStatus posts a bot message for agents', async () => {
    const service = buildService({});
    const createBotMessage = mock.fn(async () => ({ id: 1 }));
    (service as any).createBotMessage = createBotMessage;
    (service as any).clientCw = async () => {
      (service as any).provider = { enabled: true, accountId: '1' };
      return {};
    };

    await service.notifyTemplateStatus(
      { instanceName: 'meta-instance' } as any,
      {
        field: 'message_template_status_update',
        message_template_name: 'hello_world',
        message_template_id: '555',
        event: 'APPROVED',
      },
    );

    assert.equal(createBotMessage.mock.callCount(), 1);
    const content = createBotMessage.mock.calls[0].arguments[1];
    assert.match(content, /Meta template update/);
    assert.match(content, /hello_world/);
    assert.match(content, /APPROVED/);
  });

  it('receiveWebhook message_type=template calls sendTemplate for Business instances', async () => {
    speedUpWebhookDelay();

    const templateMessage = mock.fn(async () => ({
      key: { id: 'wamid.1', fromMe: true, remoteJid: '49151@s.whatsapp.net' },
      messageTimestamp: 1,
    }));
    const textMessage = mock.fn(async () => undefined);

    const service = buildService({
      'meta-instance': {
        instanceId: 'inst-1',
        templateMessage,
        textMessage,
      },
    });

    (service as any).clientCw = async () => {
      (service as any).provider = {
        enabled: true,
        accountId: '1',
        reopenConversation: true,
        signMsg: false,
        ignoreJids: [],
      };
      return { messages: { create: mock.fn(async () => ({})) } };
    };

    const result = await service.receiveWebhook(
      { instanceName: 'meta-instance', instanceId: 'inst-1' } as any,
      {
        event: 'message_created',
        message_type: 'template',
        private: false,
        content: 'ignored when template_params present',
        content_attributes: {
          template_params: {
            name: 'vsl_challenge_1',
            language: 'de',
            processed_params: { body: { '1': 'abc' } },
          },
        },
        conversation: {
          id: 42,
          messages: [{ sender: { available_name: 'Agent' } }],
          meta: { sender: { phone_number: '+4915167098941', identifier: '4915167098941' } },
          contact_inbox: { source_id: 'src-1' },
        },
        inbox: { id: 1, name: 'WhatsApp Business Funnel' },
        id: 99,
      },
    );

    assert.equal(result?.message, 'bot');
    assert.equal(templateMessage.mock.callCount(), 1);
    assert.equal(textMessage.mock.callCount(), 0);

    const payload = templateMessage.mock.calls[0].arguments[0];
    assert.equal(payload.name, 'vsl_challenge_1');
    assert.equal(payload.language, 'de');
    assert.equal(payload.number, '4915167098941');
    assert.equal(payload.components[0].parameters[0].text, 'abc');
  });

  it('receiveWebhook outgoing meta canned response calls sendTemplate', async () => {
    speedUpWebhookDelay();

    const templateMessage = mock.fn(async () => ({
      key: { id: 'wamid.2', fromMe: true, remoteJid: '49151@s.whatsapp.net' },
      messageTimestamp: 2,
    }));

    const service = buildService({
      'meta-instance': {
        instanceId: 'inst-1',
        templateMessage,
        textMessage: mock.fn(async () => undefined),
      },
    });

    (service as any).clientCw = async () => {
      (service as any).provider = {
        enabled: true,
        accountId: '1',
        reopenConversation: true,
        signMsg: false,
        ignoreJids: [],
      };
      return { messages: { create: mock.fn(async () => ({})) } };
    };
    (service as any).updateChatwootMessageId = mock.fn(async () => undefined);
    (service as any).getQuotedMessage = mock.fn(async () => undefined);

    const content = buildMetaCannedContent({
      source: 'meta',
      readOnly: true,
      name: 'vsl_challenge_1',
      language: 'de',
      category: 'MARKETING',
      status: 'APPROVED',
      metaTemplateId: '2161300034810897',
      components: [{ type: 'BODY', text: 'Hello {{1}}' }],
    }).replace('params:', 'params: link-value');

    await service.receiveWebhook(
      { instanceName: 'meta-instance', instanceId: 'inst-1' } as any,
      {
        event: 'message_created',
        message_type: 'outgoing',
        private: false,
        content,
        conversation: {
          id: 42,
          messages: [{ id: 1, sender: { available_name: 'Agent' }, content, attachments: [] }],
          meta: { sender: { phone_number: '+4915167098941', identifier: '4915167098941' } },
          contact_inbox: { source_id: 'src-1' },
        },
        inbox: { id: 1 },
        id: 100,
        sender: { name: 'Agent' },
      },
    );

    assert.equal(templateMessage.mock.callCount(), 1);
    const payload = templateMessage.mock.calls[0].arguments[0];
    assert.equal(payload.name, 'vsl_challenge_1');
    assert.equal(payload.components[0].parameters[0].text, 'link-value');
  });
});
