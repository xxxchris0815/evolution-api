import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BaileysMessageProcessor } from '../../src/api/integrations/channel/whatsapp/baileysMessage.processor';

describe('BaileysMessageProcessor (unit)', () => {
  it('forwards messages.upsert batches to onMessageReceive', async () => {
    const processor = new BaileysMessageProcessor();
    const received: any[] = [];

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timed out waiting for processor')), 3000);

      processor.mount({
        onMessageReceive: async (payload, settings) => {
          received.push({ payload, settings });
          clearTimeout(timeout);
          resolve();
        },
      });

      processor.processMessage(
        {
          messages: [
            {
              key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'ABC123' },
              message: { conversation: 'hello from baileys' },
              messageTimestamp: Math.floor(Date.now() / 1000),
            } as any,
          ],
          type: 'notify',
        },
        { groupsIgnore: false },
      );
    });

    assert.equal(received.length, 1);
    assert.equal(received[0].payload.type, 'notify');
    assert.equal(received[0].payload.messages[0].message.conversation, 'hello from baileys');
    assert.equal(received[0].settings.groupsIgnore, false);

    processor.onDestroy();
  });

  it('can remount after destroy without throwing', async () => {
    const processor = new BaileysMessageProcessor();
    let calls = 0;

    processor.mount({
      onMessageReceive: async () => {
        calls += 1;
      },
    });
    processor.onDestroy();

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timed out after remount')), 3000);
      processor.mount({
        onMessageReceive: async () => {
          calls += 1;
          clearTimeout(timeout);
          resolve();
        },
      });
      processor.processMessage(
        {
          messages: [{ key: { id: '1', remoteJid: 'x@s.whatsapp.net', fromMe: true }, message: { conversation: 'x' } } as any],
          type: 'notify',
        },
        {},
      );
    });

    assert.equal(calls, 1);
    processor.onDestroy();
  });
});
