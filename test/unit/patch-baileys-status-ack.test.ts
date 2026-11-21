import assert from 'node:assert/strict';
import test from 'node:test';

import { MARKER, patchSource } from '../../scripts/patch-baileys-status-ack.js';

const FIXTURE = `    const offlineNodeProcessor = makeOfflineNodeProcessor(new Map([
        ['message', handleMessage],
        ['call', handleCall],
        ['receipt', handleReceipt],
        ['notification', handleNotification]
    ]), {
        isWsOpen: () => ws.isOpen,
    });
    ws.on('CB:notification', async (node) => {
        await processNode('notification', node, 'handling notification', handleNotification);
    });
    ws.on('CB:ack,class:message', (node) => {
        handleBadAck(node).catch(error => onUnexpectedError(error, 'handling bad ack'));
    });
`;

test('patch-baileys-status-ack inserts CB:status handler and offline map entry', () => {
  const first = patchSource(FIXTURE);
  assert.equal(first.changed, true);
  assert.equal(first.reason, 'patched');
  assert.match(first.source, new RegExp(MARKER));
  assert.match(first.source, /ws\.on\('CB:status'/);
  assert.match(first.source, /\['status', handleStatus\]/);

  const second = patchSource(first.source);
  assert.equal(second.changed, false);
  assert.equal(second.reason, 'already-patched');
});

test('patch-baileys-status-ack fails closed when anchors are missing', () => {
  const result = patchSource('export const noop = true;\n');
  assert.equal(result.changed, false);
  assert.equal(result.reason, 'offline-map-anchor-missing');
});
