import { status } from '@utils/renderStatus';

/**
 * Map Meta Cloud API status strings to Evolution StatusMessage values.
 * Meta: sent | delivered | read | failed
 * Evolution: SERVER_ACK | DELIVERY_ACK | READ | ERROR
 */
export function mapMetaMessageStatus(metaStatus: string | undefined | null): string | null {
  if (!metaStatus) {
    return null;
  }

  switch (String(metaStatus).toLowerCase()) {
    case 'sent':
      return status[2]; // SERVER_ACK
    case 'delivered':
      return status[3]; // DELIVERY_ACK
    case 'read':
      return status[4]; // READ
    case 'failed':
      return status[0]; // ERROR
    case 'deleted':
      return 'DELETED';
    default:
      return String(metaStatus).toUpperCase();
  }
}
