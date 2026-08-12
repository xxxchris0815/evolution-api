export class SettingsDto {
  rejectCall?: boolean;
  msgCall?: string;
  groupsIgnore?: boolean;
  alwaysOnline?: boolean;
  readMessages?: boolean;
  readStatus?: boolean;
  syncFullHistory?: boolean;
  wavoipToken?: string;
  /** Forward raw Meta webhook schema from /webhook/meta for this instance */
  metaWebhookPassthrough?: boolean;
}
