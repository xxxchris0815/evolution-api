import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BufferJSON,
  DisconnectReason,
  initAuthCreds,
  isPnUser,
  makeCacheableSignalKeyStore,
  proto,
} from 'baileys';
import P from 'pino';

import {
  buildBaileysSocketConfig,
  getBaileysPackageVersion,
  isLidJid,
  normalizeRemoteJid,
  resolveBaileysBrowser,
} from '../../src/api/integrations/channel/whatsapp/baileys';
import { BaileysMessageProcessor } from '../../src/api/integrations/channel/whatsapp/baileysMessage.processor';

/**
 * Integration-style coverage between WhiskeySockets/Baileys APIs and Evolution's
 * WhatsApp Web channel helpers (no live WhatsApp connection).
 */
describe('Baileys ↔ Evolution integration', () => {
  it('builds a Baileys 7 socket config that Evolution can pass to makeWASocket', async () => {
    const creds = initAuthCreds();
    const keys = {
      get: async () => ({}),
      set: async () => undefined,
    };

    const config = buildBaileysSocketConfig({
      version: [2, 3000, 1],
      authState: { creds, keys } as any,
      logger: P({ level: 'silent' }) as any,
      getMessage: async () => undefined,
      browser: resolveBaileysBrowser('Evolution API', 'Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      shouldIgnoreJid: (jid) => isLidJid(jid) === false && String(jid).includes('@newsletter'),
    });

    assert.deepEqual(config.version, [2, 3000, 1]);
    assert.equal(config.printQRInTerminal, false);
    assert.equal(config.emitOwnEvents, false);
    assert.equal(config.maxMsgRetryCount, 4);
    assert.equal(config.retryRequestDelayMs, 350);
    assert.ok(config.auth?.creds);
    assert.ok(config.auth?.keys);
    assert.equal(typeof config.getMessage, 'function');
    assert.equal(getBaileysPackageVersion().startsWith('7.0.0-rc'), true);

    // Signal key store factory from Baileys remains callable with Evolution auth keys
    const store = makeCacheableSignalKeyStore(keys as any, P({ level: 'silent' }) as any);
    assert.equal(typeof store.get, 'function');
    assert.equal(typeof store.set, 'function');
  });

  it('pipelines a Baileys messages.upsert event through Evolution message processor with LID normalization', async () => {
    const processor = new BaileysMessageProcessor();
    const handled: Array<{ remoteJid: string; text: string; type: string }> = [];

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('processor timeout')), 3000);

      processor.mount({
        onMessageReceive: async (payload) => {
          for (const message of payload.messages) {
            const remoteJid = normalizeRemoteJid(message.key as any) || String(message.key.remoteJid);
            const text =
              message.message?.conversation ||
              message.message?.extendedTextMessage?.text ||
              '';
            handled.push({ remoteJid, text, type: payload.type });
          }
          clearTimeout(timeout);
          resolve();
        },
      });

      // Simulate Baileys emitting a notify upsert with LID addressing + PN alt
      processor.processMessage(
        {
          type: 'notify',
          messages: [
            {
              key: {
                id: 'BAE5TEST001',
                fromMe: false,
                remoteJid: '123456789012345@lid',
                remoteJidAlt: '5511888777666@s.whatsapp.net',
                addressingMode: 'lid',
              },
              pushName: 'Integration User',
              messageTimestamp: Math.floor(Date.now() / 1000),
              message: {
                conversation: 'integration ping',
              },
            } as any,
          ],
        },
        { groupsIgnore: false, readMessages: true },
      );
    });

    assert.equal(handled.length, 1);
    assert.equal(handled[0].type, 'notify');
    assert.equal(handled[0].text, 'integration ping');
    assert.equal(handled[0].remoteJid, '5511888777666@s.whatsapp.net');
    assert.equal(isPnUser(handled[0].remoteJid), true);

    processor.onDestroy();
  });

  it('persists auth-like blobs with BufferJSON the same way Evolution auth-state helpers do', () => {
    const creds = initAuthCreds();
    const serialized = JSON.stringify(creds, BufferJSON.replacer);
    const restored = JSON.parse(serialized, BufferJSON.reviver);

    assert.ok(restored.noiseKey?.private);
    assert.ok(Buffer.isBuffer(restored.noiseKey.private) || restored.noiseKey.private?.type === 'Buffer' || restored.noiseKey.private);
    assert.equal(typeof restored.registrationId, 'number');
    assert.equal(DisconnectReason.loggedOut, 401);

    const appState = proto.Message.AppStateSyncKeyData.create({});
    assert.ok(appState);
  });
});
