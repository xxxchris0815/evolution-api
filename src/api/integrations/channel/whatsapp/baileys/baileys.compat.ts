import { readFileSync } from 'node:fs';
import { release } from 'node:os';
import { join } from 'node:path';

import { Browsers, isPnUser, type WABrowserDescription } from 'baileys';
import type { Label as BaileysLabel } from 'baileys/lib/Types/Label';
import type { LabelAssociation as BaileysLabelAssociation } from 'baileys/lib/Types/LabelAssociation';

export type { BaileysLabel, BaileysLabelAssociation };

/** Minimum supported Baileys release for this Evolution fork. */
export const BAILEYS_MIN_VERSION = '7.0.0-rc14';

export function getBaileysPackageVersion(): string {
  try {
    const pkgPath = require.resolve('baileys/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version || 'unknown';
  } catch {
    try {
      const pkgPath = join(process.cwd(), 'node_modules', 'baileys', 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
      return pkg.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

export function isLidJid(jid?: string | null): boolean {
  return typeof jid === 'string' && jid.endsWith('@lid');
}

export function isPhoneNumberJid(jid?: string | null): boolean {
  return typeof jid === 'string' && isPnUser(jid);
}

/**
 * Resolve WhatsApp Web browser fingerprint for Baileys socket config.
 * Prefer `Browsers.android` when configured so view-once media can be received (Baileys rc14+).
 */
export function resolveBaileysBrowser(client: string, name: string): WABrowserDescription {
  const clientNorm = (client || '').trim().toLowerCase();
  const nameNorm = (name || '').trim().toLowerCase();

  if (clientNorm === 'android' || nameNorm === 'android') {
    return Browsers.android(client || 'Evolution API');
  }

  if (clientNorm === 'mac os' || clientNorm === 'macos' || nameNorm === 'desktop') {
    return Browsers.macOS(name || 'Desktop');
  }

  if (clientNorm === 'ubuntu' || nameNorm === 'chrome') {
    return Browsers.ubuntu(name || 'Chrome');
  }

  if (clientNorm === 'windows') {
    return Browsers.windows(name || 'Chrome');
  }

  // Preserve Evolution's historical custom browser tuple when no preset matches.
  return [client || 'Evolution API', name || 'Chrome', release()];
}

export function normalizeRemoteJid(key: {
  remoteJid?: string | null;
  remoteJidAlt?: string | null;
  addressingMode?: string | null;
}): string | undefined {
  if (!key?.remoteJid) {
    return undefined;
  }

  if (isLidJid(key.remoteJid) && key.remoteJidAlt) {
    return key.remoteJidAlt;
  }

  return key.remoteJid;
}
