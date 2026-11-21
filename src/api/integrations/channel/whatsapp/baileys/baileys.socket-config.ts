import {
  type AuthenticationState,
  makeCacheableSignalKeyStore,
  type proto,
  type UserFacingSocketConfig,
  type WAVersion,
} from 'baileys';
import type { Logger } from 'pino';

export type BuildBaileysSocketConfigInput = {
  version: WAVersion;
  authState: AuthenticationState;
  logger: Logger;
  getMessage: (key: proto.IMessageKey) => Promise<proto.IMessage | undefined>;
  browser?: UserFacingSocketConfig['browser'];
  markOnlineOnConnect?: boolean;
  syncFullHistory?: boolean;
  shouldIgnoreJid?: UserFacingSocketConfig['shouldIgnoreJid'];
  shouldSyncHistoryMessage?: UserFacingSocketConfig['shouldSyncHistoryMessage'];
  cachedGroupMetadata?: UserFacingSocketConfig['cachedGroupMetadata'];
  userDevicesCache?: UserFacingSocketConfig['userDevicesCache'];
  msgRetryCounterCache?: UserFacingSocketConfig['msgRetryCounterCache'];
  agent?: UserFacingSocketConfig['agent'];
  fetchAgent?: UserFacingSocketConfig['fetchAgent'];
  patchMessageBeforeSending?: UserFacingSocketConfig['patchMessageBeforeSending'];
};

/**
 * Shared Baileys 7.x socket defaults used by Evolution's WhatsApp Web channel.
 * Keeps retry / timeout / history settings aligned with WhiskeySockets rc14+.
 */
export function buildBaileysSocketConfig(input: BuildBaileysSocketConfigInput): UserFacingSocketConfig {
  const {
    version,
    authState,
    logger,
    getMessage,
    browser,
    markOnlineOnConnect,
    syncFullHistory,
    shouldIgnoreJid,
    shouldSyncHistoryMessage,
    cachedGroupMetadata,
    userDevicesCache,
    msgRetryCounterCache,
    agent,
    fetchAgent,
    patchMessageBeforeSending,
  } = input;

  return {
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, logger as any),
    },
    msgRetryCounterCache,
    generateHighQualityLinkPreview: true,
    getMessage,
    browser,
    markOnlineOnConnect,
    retryRequestDelayMs: 350,
    maxMsgRetryCount: 4,
    fireInitQueries: true,
    connectTimeoutMs: 30_000,
    keepAliveIntervalMs: 30_000,
    qrTimeout: 45_000,
    emitOwnEvents: false,
    shouldIgnoreJid,
    syncFullHistory,
    shouldSyncHistoryMessage,
    cachedGroupMetadata,
    userDevicesCache,
    transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
    agent,
    fetchAgent,
    patchMessageBeforeSending,
  };
}
