import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import axios from 'axios';

import { ChatwootTemplateSyncService } from '../../src/api/integrations/chatbot/chatwoot/services/chatwoot.template.sync.service';
import { buildMetaCannedShortCode } from '../../src/utils/chatwoot-template.helper';

describe('ChatwootTemplateSyncService (integration)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('syncs APPROVED Meta templates to Chatwoot as read-only meta_* canned responses and imports user canned', async () => {
    const approved = {
      id: '2161300034810897',
      name: 'vsl_challenge_1',
      language: 'de',
      category: 'MARKETING',
      status: 'APPROVED',
      components: [{ type: 'BODY', text: 'Hello {{1}}' }],
    };
    const pending = {
      id: '999',
      name: 'pending_tpl',
      language: 'en_US',
      category: 'UTILITY',
      status: 'PENDING',
      components: [],
    };

    const shortCode = buildMetaCannedShortCode(approved.id, approved.name, approved.language);

    const templateUpsert = mock.fn(async ({ create, update, where }: any) => ({
      id: `local-${where.templateId}`,
      templateId: where.templateId,
      name: create?.name || update?.name,
      chatwootCannedId: create?.source === 'chatwoot' ? create.chatwootCannedId : null,
      source: create?.source || update?.source,
      readOnly: create?.readOnly ?? update?.readOnly,
    }));
    const templateUpdate = mock.fn(async () => undefined);

    const prismaRepository = {
      instance: {
        findUnique: mock.fn(async () => ({
          id: 'inst-1',
          name: 'meta-instance',
          Chatwoot: {
            enabled: true,
            url: 'https://chat.example',
            accountId: '1',
            token: 'cw-token',
            nameInbox: 'inbox',
          },
        })),
      },
      template: {
        upsert: templateUpsert,
        update: templateUpdate,
      },
    } as any;

    const templateService = {
      find: mock.fn(async () => ({ data: [approved, pending] })),
    } as any;

    const axiosCalls: Array<{ method: string; url: string; data?: any }> = [];
    let cannedStore = [
      { id: 10, short_code: 'welcome_user', content: 'Hello from agent' },
      { id: 11, short_code: 'meta_stale_old_11111111', content: '[META:readonly] stale' },
    ];

    mock.method(axios, 'get', async (url: string) => {
      axiosCalls.push({ method: 'GET', url });
      return { data: [...cannedStore] };
    });
    mock.method(axios, 'post', async (url: string, data: any) => {
      axiosCalls.push({ method: 'POST', url, data });
      const created = { id: 20, short_code: data.short_code, content: data.content };
      cannedStore = [...cannedStore.filter((c) => c.short_code !== data.short_code), created];
      return { data: created };
    });
    mock.method(axios, 'patch', async (url: string, data: any) => {
      axiosCalls.push({ method: 'PATCH', url, data });
      return { data: { id: 20, short_code: data.short_code, content: data.content } };
    });
    mock.method(axios, 'delete', async (url: string) => {
      axiosCalls.push({ method: 'DELETE', url });
      const id = Number(url.split('/').pop());
      cannedStore = cannedStore.filter((c) => c.id !== id);
      return { data: {} };
    });

    const service = new ChatwootTemplateSyncService(prismaRepository, templateService);
    const result = await service.sync({ instanceName: 'meta-instance' } as any);

    assert.equal(result.metaSynced, 2);
    assert.equal(result.chatwootUserTemplates, 1);
    assert.equal(result.meta[0].shortCode, shortCode);
    assert.equal(result.meta[0].readOnly, true);
    assert.equal(result.meta[0].source, 'meta');
    assert.equal(result.chatwoot[0].source, 'chatwoot');
    assert.equal(result.chatwoot[0].readOnly, false);

    // APPROVED template created in Chatwoot
    assert.ok(axiosCalls.some((c) => c.method === 'POST' && c.data?.short_code === shortCode));
    assert.match(axiosCalls.find((c) => c.method === 'POST' && c.data?.short_code === shortCode)!.data.content, /\[META:readonly\]/);

    // stale meta_* canned deleted; user canned kept
    assert.ok(axiosCalls.some((c) => c.method === 'DELETE' && c.url.endsWith('/11')));
    assert.equal(
      axiosCalls.some((c) => c.method === 'DELETE' && c.url.endsWith('/10')),
      false,
    );

    // pending meta template should not create canned, and local upsert still happens
    assert.equal(templateUpsert.mock.callCount() >= 3, true); // 2 meta + 1 chatwoot user
    assert.ok(templateUpdate.mock.callCount() >= 1); // chatwootCannedId update for approved
  });

  it('rejects sync when Chatwoot is not configured', async () => {
    const service = new ChatwootTemplateSyncService(
      {
        instance: {
          findUnique: mock.fn(async () => ({ id: 'inst-1', name: 'meta-instance', Chatwoot: null })),
        },
      } as any,
      { find: mock.fn(async () => ({ data: [] })) } as any,
    );

    await assert.rejects(
      () => service.sync({ instanceName: 'meta-instance' } as any),
      /Chatwoot is not configured/,
    );
  });
});
