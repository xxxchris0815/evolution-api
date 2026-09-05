import axios from 'axios';

/**
 * Resolve WhatsApp Business Account ID for Graph template APIs.
 * Callers often store phone_number_id in businessId by mistake.
 */
export async function resolveWhatsappBusinessAccountId(params: {
  graphUrl: string;
  version: string;
  token: string;
  phoneNumberId?: string | null;
  businessId?: string | null;
}): Promise<{ businessId: string; resolvedFrom: 'provided' | 'health_status' | 'phone_number_id' }> {
  const { graphUrl, version, token, phoneNumberId, businessId } = params;
  const base = `${graphUrl.replace(/\/$/, '')}/${version}`;
  const headers = { Authorization: `Bearer ${token}` };

  const candidate = businessId?.trim();
  if (candidate && candidate !== phoneNumberId) {
    try {
      const { data } = await axios.get(`${base}/${candidate}/message_templates`, {
        headers,
        params: { limit: 1 },
        validateStatus: () => true,
      });
      if (!data?.error) {
        return { businessId: candidate, resolvedFrom: 'provided' };
      }
    } catch {
      // fall through to health_status resolution
    }
  }

  const phoneId = phoneNumberId?.trim() || (candidate === phoneNumberId ? candidate : undefined);
  if (!phoneId) {
    if (candidate) return { businessId: candidate, resolvedFrom: 'provided' };
    throw new Error('Unable to resolve WABA: missing businessId and phone number id');
  }

  const { data } = await axios.get(`${base}/${phoneId}`, {
    headers,
    params: { fields: 'id,health_status' },
  });

  const waba = (data?.health_status?.entities || []).find(
    (entity: { entity_type?: string; id?: string }) => entity?.entity_type === 'WABA' && entity?.id,
  );

  if (waba?.id) {
    return { businessId: `${waba.id}`, resolvedFrom: 'health_status' };
  }

  // Last resort: provided businessId even if it equals phone number id
  if (candidate) {
    return { businessId: candidate, resolvedFrom: 'phone_number_id' };
  }

  throw new Error(`Unable to resolve WABA from phone number id ${phoneId}`);
}
