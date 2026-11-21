import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import axios from 'axios';

import {
  buildMetaCannedContent,
  buildMetaCannedShortCode,
  isMetaManagedCannedShortCode,
  parseChatwootTemplateMessage,
  parseMetaCannedContent,
} from '../../src/utils/chatwoot-template.helper';
import { resolveWhatsappBusinessAccountId } from '../../src/utils/resolveWabaId';

describe('chatwoot-template.helper (unit)', () => {
  it('builds meta short codes and detects managed canned responses', () => {
    const code = buildMetaCannedShortCode('2161300034810897', 'vsl_challenge_1', 'de');
    assert.equal(code.startsWith('meta_'), true);
    assert.equal(isMetaManagedCannedShortCode(code), true);
    assert.equal(isMetaManagedCannedShortCode('welcome_user'), false);
  });

  it('round-trips meta canned content and parses send payload', () => {
    const content = buildMetaCannedContent({
      source: 'meta',
      readOnly: true,
      name: 'vsl_challenge_1',
      language: 'de',
      category: 'MARKETING',
      status: 'APPROVED',
      metaTemplateId: '2161300034810897',
      components: [{ type: 'BODY', text: 'Hello {{1}}' }],
    });

    assert.match(content, /\[META:readonly\]/);
    const withParams = content.replace('params:', 'params: abc123');
    const parsed = parseMetaCannedContent(withParams);
    assert.equal(parsed?.name, 'vsl_challenge_1');
    assert.equal(parsed?.language, 'de');
    assert.equal(parsed?.components?.[0]?.parameters?.[0]?.text, 'abc123');
  });

  it('parses Chatwoot template_params into sendTemplate shape', () => {
    const parsed = parseChatwootTemplateMessage({
      content_attributes: {
        template_params: {
          name: 'hello',
          language: 'en_US',
          processed_params: { body: { '1': 'Ada' } },
        },
      },
    });

    assert.equal(parsed?.name, 'hello');
    assert.equal(parsed?.components?.[0]?.type, 'body');
    assert.equal(parsed?.components?.[0]?.parameters?.[0]?.text, 'Ada');
  });
});

describe('resolveWhatsappBusinessAccountId (unit)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('keeps provided businessId when message_templates is accessible', async () => {
    mock.method(axios, 'get', async (url: string) => {
      if (url.includes('/waba-1/message_templates')) {
        return { data: { data: [] } };
      }
      throw new Error(`unexpected url ${url}`);
    });

    const resolved = await resolveWhatsappBusinessAccountId({
      graphUrl: 'https://graph.facebook.com',
      version: 'v26.0',
      token: 'token',
      phoneNumberId: 'phone-1',
      businessId: 'waba-1',
    });

    assert.deepEqual(resolved, { businessId: 'waba-1', resolvedFrom: 'provided' });
  });

  it('resolves WABA from phone health_status when businessId is phone number id', async () => {
    mock.method(axios, 'get', async (url: string) => {
      if (url.includes('/phone-1/message_templates')) {
        return { data: { error: { message: 'nonexisting field' } } };
      }
      if (url.endsWith('/phone-1')) {
        return {
          data: {
            id: 'phone-1',
            health_status: {
              entities: [
                { entity_type: 'PHONE_NUMBER', id: 'phone-1' },
                { entity_type: 'WABA', id: '1927389251285728' },
              ],
            },
          },
        };
      }
      throw new Error(`unexpected url ${url}`);
    });

    const resolved = await resolveWhatsappBusinessAccountId({
      graphUrl: 'https://graph.facebook.com',
      version: 'v26.0',
      token: 'token',
      phoneNumberId: 'phone-1',
      businessId: 'phone-1',
    });

    assert.deepEqual(resolved, { businessId: '1927389251285728', resolvedFrom: 'health_status' });
  });
});
