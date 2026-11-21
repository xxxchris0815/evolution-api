#!/usr/bin/env node
/**
 * Patch Baileys 7.0.0-rc14 to ACK top-level WhatsApp <status> stanzas.
 *
 * Upstream bug: WhiskeySockets/Baileys#2858
 * Upstream fix (unreleased): PR #2883 / #2866
 *
 * Without this, WhatsApp closes the stream ~50 minutes after an unacked
 * status with: stream:error → ack class="status". Evolution reconnects and
 * looks "open", but inbound delivery can stall until a hard restart.
 *
 * Safe no-op when baileys is missing or already patched.
 */
const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'EVOLUTION_PATCH_BAILEYS_STATUS_ACK';

const TARGET = path.join(
  process.cwd(),
  'node_modules',
  'baileys',
  'lib',
  'Socket',
  'messages-recv.js',
);

function patchSource(source) {
  if (source.includes(MARKER)) {
    return { source, changed: false, reason: 'already-patched' };
  }

  const offlineNeedle = `    const offlineNodeProcessor = makeOfflineNodeProcessor(new Map([
        ['message', handleMessage],
        ['call', handleCall],
        ['receipt', handleReceipt],
        ['notification', handleNotification]
    ]), {`;

  const offlineReplacement = `    // ${MARKER}: ack top-level <status> stanzas (Baileys#2858)
    const handleStatus = async (node) => {
        await sendMessageAck(node);
    };
    const offlineNodeProcessor = makeOfflineNodeProcessor(new Map([
        ['message', handleMessage],
        ['call', handleCall],
        ['receipt', handleReceipt],
        ['notification', handleNotification],
        ['status', handleStatus]
    ]), {`;

  if (!source.includes(offlineNeedle)) {
    return { source, changed: false, reason: 'offline-map-anchor-missing' };
  }

  let next = source.replace(offlineNeedle, offlineReplacement);

  const notificationNeedle = `    ws.on('CB:notification', async (node) => {
        await processNode('notification', node, 'handling notification', handleNotification);
    });
    ws.on('CB:ack,class:message', (node) => {
        handleBadAck(node).catch(error => onUnexpectedError(error, 'handling bad ack'));
    });`;

  const notificationReplacement = `    ws.on('CB:notification', async (node) => {
        await processNode('notification', node, 'handling notification', handleNotification);
    });
    // ${MARKER}: live + offline status ACKs
    ws.on('CB:status', async (node) => {
        await processNode('status', node, 'acking status', handleStatus);
    });
    ws.on('CB:ack,class:message', (node) => {
        handleBadAck(node).catch(error => onUnexpectedError(error, 'handling bad ack'));
    });`;

  if (!next.includes(notificationNeedle)) {
    return { source, changed: false, reason: 'notification-anchor-missing' };
  }

  next = next.replace(notificationNeedle, notificationReplacement);

  if (!next.includes(MARKER) || !next.includes("ws.on('CB:status'")) {
    return { source, changed: false, reason: 'patch-verification-failed' };
  }

  return { source: next, changed: true, reason: 'patched' };
}

function main() {
  if (!fs.existsSync(TARGET)) {
    console.log('[patch-baileys-status-ack] baileys messages-recv.js not found, skipping');
    process.exit(0);
  }

  const original = fs.readFileSync(TARGET, 'utf8');
  const result = patchSource(original);

  if (!result.changed) {
    if (result.reason === 'already-patched') {
      console.log('[patch-baileys-status-ack] already applied');
      process.exit(0);
    }

    console.error(`[patch-baileys-status-ack] FAILED: ${result.reason}`);
    console.error(
      '[patch-baileys-status-ack] Baileys file layout may have changed; refusing silent skip',
    );
    process.exit(1);
  }

  fs.writeFileSync(TARGET, result.source);
  console.log('[patch-baileys-status-ack] patched CB:status ACK handler (Baileys#2858)');
}

if (require.main === module) {
  main();
}

module.exports = { patchSource, MARKER, TARGET };
