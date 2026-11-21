import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BufferJSON, DisconnectReason, isPnUser, proto } from 'baileys';

import {
  BAILEYS_MIN_VERSION,
  getBaileysPackageVersion,
  isLidJid,
  isPhoneNumberJid,
  normalizeRemoteJid,
  resolveBaileysBrowser,
} from '../../src/api/integrations/channel/whatsapp/baileys';

describe('Baileys compatibility module (unit)', () => {
  it('resolves installed Baileys package to minimum supported rc14+', () => {
    const version = getBaileysPackageVersion();
    assert.match(version, /^7\.0\.0-rc\d+$/);
    const installedRc = Number(version.replace(/^7\.0\.0-rc\.?/, ''));
    const minRc = Number(BAILEYS_MIN_VERSION.replace(/^7\.0\.0-rc\.?/, ''));
    assert.ok(installedRc >= minRc, `expected >= ${BAILEYS_MIN_VERSION}, got ${version}`);
  });

  it('classifies PN vs LID JIDs using Baileys isPnUser', () => {
    assert.equal(isPnUser('5511999999999@s.whatsapp.net'), true);
    assert.equal(isPhoneNumberJid('5511999999999@s.whatsapp.net'), true);
    assert.equal(isLidJid('123456789012345@lid'), true);
    assert.equal(isPhoneNumberJid('123456789012345@lid'), false);
    assert.equal(isLidJid('5511999999999@s.whatsapp.net'), false);
  });

  it('normalizes LID remoteJid to phone-number alt when available', () => {
    assert.equal(
      normalizeRemoteJid({
        remoteJid: '999@lid',
        remoteJidAlt: '5511999999999@s.whatsapp.net',
      }),
      '5511999999999@s.whatsapp.net',
    );
    assert.equal(
      normalizeRemoteJid({
        remoteJid: '5511999999999@s.whatsapp.net',
      }),
      '5511999999999@s.whatsapp.net',
    );
  });

  it('resolves Android browser preset for view-once support (Baileys rc14)', () => {
    const browser = resolveBaileysBrowser('Android', 'Evolution API');
    assert.ok(Array.isArray(browser));
    assert.equal(browser.length, 3);
    assert.match(String(browser[0]), /Android|Evolution/i);
  });

  it('uses Baileys slim protobuf create() helper and BufferJSON roundtrip', () => {
    const created = proto.Message.AppStateSyncKeyData.create({});
    assert.ok(created);

    const payload = {
      key: Buffer.from('hello-baileys'),
      reason: DisconnectReason.loggedOut,
    };
    const encoded = JSON.stringify(payload, BufferJSON.replacer);
    const decoded = JSON.parse(encoded, BufferJSON.reviver);
    assert.ok(Buffer.isBuffer(decoded.key));
    assert.equal(decoded.key.toString(), 'hello-baileys');
    assert.equal(decoded.reason, 401);
  });
});
