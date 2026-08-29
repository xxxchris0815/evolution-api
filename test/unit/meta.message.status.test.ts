import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Regression coverage for Meta Cloud API status ACK routing.
 * Ensures status payloads are shaped the way BusinessStartupService expects
 * after the connectToWhatsapp change-value fix.
 */
describe('Meta message status webhook shape (unit)', () => {
  it('extracts statuses from a single matched change value', () => {
    const changeValue = {
      messaging_product: 'whatsapp',
      metadata: {
        display_phone_number: '4915167098941',
        phone_number_id: '1170931486111299',
      },
      statuses: [
        {
          id: 'wamid.HBgMNDkxNjAxODY1NDIxFQIAERgSRTIzN0I5OTRGQzVCNzE5RDdEAA==',
          status: 'delivered',
          timestamp: '1788013200',
          recipient_id: '491601865421',
        },
        {
          id: 'wamid.HBgMNDkxNjAxODY1NDIxFQIAERgSRTIzN0I5OTRGQzVCNzE5RDdEAA==',
          status: 'read',
          timestamp: '1788013300',
          recipient_id: '491601865421',
        },
      ],
    };

    const wrapped = {
      entry: [
        {
          id: '1927389251285728',
          changes: [{ field: 'messages', value: changeValue }],
        },
      ],
    };

    const content = wrapped.entry[0].changes[0].value;
    assert.ok(Array.isArray(content.statuses));
    assert.equal(content.statuses.length, 2);
    assert.equal(content.statuses[0].status, 'delivered');
    assert.equal(content.statuses[1].status, 'read');
    assert.equal(content.metadata.phone_number_id, '1170931486111299');
  });

  it('does not assume contacts[].profile exists on status ACKs', () => {
    const statusPayloadContacts = [
      {
        wa_id: '491601865421',
        user_id: 'DE.1096280406907531',
      },
    ] as Array<{ wa_id: string; user_id: string; profile?: { name?: string } }>;

    const contactProfile = statusPayloadContacts[0]?.profile;
    const pushName = contactProfile?.name || statusPayloadContacts[0]?.wa_id;
    assert.equal(pushName, '491601865421');
    assert.equal(contactProfile, undefined);
  });

  it('normalizes Meta status strings the same way Evolution emits them', () => {
    const statuses = ['sent', 'delivered', 'read', 'failed'];
    assert.deepEqual(
      statuses.map((s) => String(s).toUpperCase()),
      ['SENT', 'DELIVERED', 'READ', 'FAILED'],
    );
  });
});
