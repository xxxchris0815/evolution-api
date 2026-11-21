import { InstanceDto } from '@api/dto/instance.dto';
import { MetaWebhookConfigDto } from '@api/dto/metaWebhookConfig.dto';
import { PrismaRepository } from '@api/repository/repository.service';
import { ConfigService, HttpServer, WaBusiness } from '@config/env.config';
import { Logger } from '@config/logger.config';

/** Minimal waMonitor surface used by this service (avoids circular import with server.module). */
type WaMonitorLike = {
  waInstances: Record<
    string,
    {
      localSettings?: { metaWebhookPassthrough?: boolean };
      localWebhook?: { enabled?: boolean; url?: string; events?: unknown };
    }
  >;
};

function badRequest(message: string): never {
  // Match Evolution BadRequestException payload without importing @exceptions
  // (exceptions → index.router → server.module creates a circular dependency).
  throw {
    status: 400,
    error: 'Bad Request',
    message: [message],
  };
}

const META_WEBHOOK_EVENT = 'META_WEBHOOK';

/**
 * Manages Meta inbound webhook configuration shown in the Manager UI:
 * callback URLs, verify token, per-instance passthrough, and META_WEBHOOK event activation.
 */
export class MetaWebhookConfigService {
  private readonly logger = new Logger('MetaWebhookConfigService');

  constructor(
    private readonly waMonitor: WaMonitorLike,
    private readonly prismaRepository: PrismaRepository,
    private readonly configService: ConfigService,
  ) {}

  private async getInstanceOrThrow(instanceName: string) {
    const instance = await this.prismaRepository.instance.findUnique({
      where: { name: instanceName },
      include: {
        Setting: true,
        Webhook: true,
      },
    });

    if (!instance) {
      badRequest('Instance not found');
    }

    if (instance.integration !== 'WHATSAPP-BUSINESS') {
      badRequest('Meta webhook config is only available for WHATSAPP-BUSINESS instances');
    }

    return instance;
  }

  public async find(instance: InstanceDto) {
    const dbInstance = await this.getInstanceOrThrow(instance.instanceName);
    const serverUrl = this.configService.get<HttpServer>('SERVER').URL.replace(/\/$/, '');
    const waBusiness = this.configService.get<WaBusiness>('WA_BUSINESS');

    const webhookEvents = Array.isArray(dbInstance.Webhook?.events) ? (dbInstance.Webhook.events as string[]) : [];

    const passthroughEnabled =
      dbInstance.Setting?.metaWebhookPassthrough === true || waBusiness.WEBHOOK_PASSTHROUGH === true;

    return {
      integration: dbInstance.integration,
      instanceName: dbInstance.name,
      callbackUrl: `${serverUrl}/webhook/meta`,
      passthroughUrl: `${serverUrl}/webhook/meta/passthrough`,
      verifyToken: waBusiness.TOKEN_WEBHOOK,
      globalPassthroughEnabled: waBusiness.WEBHOOK_PASSTHROUGH === true,
      passthroughEnabled: dbInstance.Setting?.metaWebhookPassthrough === true,
      effectivePassthroughEnabled: passthroughEnabled,
      webhookEnabled: dbInstance.Webhook?.enabled === true,
      webhookUrl: dbInstance.Webhook?.url || '',
      metaWebhookEventEnabled: webhookEvents.includes(META_WEBHOOK_EVENT),
      recommendedCallbackUrl:
        dbInstance.Setting?.metaWebhookPassthrough === true || waBusiness.WEBHOOK_PASSTHROUGH === true
          ? `${serverUrl}/webhook/meta`
          : `${serverUrl}/webhook/meta/passthrough`,
      instructions: {
        metaAppCallbackUrl:
          'Paste callbackUrl or passthroughUrl into Meta App Dashboard > WhatsApp > Configuration > Callback URL',
        verifyToken: 'Use verifyToken as the Meta Verify Token',
        activateEvent: 'Enable META_WEBHOOK on the instance webhook to receive forwarded Meta payloads',
      },
    };
  }

  public async update(instance: InstanceDto, data: MetaWebhookConfigDto) {
    const dbInstance = await this.getInstanceOrThrow(instance.instanceName);

    if (typeof data.passthroughEnabled === 'boolean') {
      await this.prismaRepository.setting.upsert({
        where: { instanceId: dbInstance.id },
        update: { metaWebhookPassthrough: data.passthroughEnabled },
        create: {
          instanceId: dbInstance.id,
          metaWebhookPassthrough: data.passthroughEnabled,
          rejectCall: false,
          groupsIgnore: false,
          alwaysOnline: false,
          readMessages: false,
          readStatus: false,
          syncFullHistory: false,
        },
      });

      // Keep in-memory settings in sync when instance is loaded
      const waInstance = this.waMonitor.waInstances[instance.instanceName];
      if (waInstance?.localSettings) {
        waInstance.localSettings.metaWebhookPassthrough = data.passthroughEnabled;
      }
    }

    if (
      typeof data.enableMetaWebhookEvent === 'boolean' ||
      data.webhookUrl ||
      typeof data.webhookEnabled === 'boolean'
    ) {
      const existing = dbInstance.Webhook;
      const currentEvents = Array.isArray(existing?.events) ? ([...(existing.events as string[])] as string[]) : [];

      let events = currentEvents;
      if (data.enableMetaWebhookEvent === true && !events.includes(META_WEBHOOK_EVENT)) {
        events = [...events, META_WEBHOOK_EVENT];
      }
      if (data.enableMetaWebhookEvent === false) {
        events = events.filter((event) => event !== META_WEBHOOK_EVENT);
      }

      const url = data.webhookUrl?.trim() || existing?.url;
      const isActivating = data.enableMetaWebhookEvent === true || data.webhookUrl || data.webhookEnabled === true;

      if (isActivating && !url) {
        badRequest('webhookUrl is required to activate META_WEBHOOK delivery');
      }

      // Nothing to persist when disabling and no webhook row exists yet
      if (!existing && !url) {
        return this.find(instance);
      }

      const enabled =
        typeof data.webhookEnabled === 'boolean'
          ? data.webhookEnabled
          : data.enableMetaWebhookEvent === true
            ? true
            : (existing?.enabled ?? true);

      await this.prismaRepository.webhook.upsert({
        where: { instanceId: dbInstance.id },
        update: {
          ...(url ? { url } : {}),
          enabled,
          events,
        },
        create: {
          instanceId: dbInstance.id,
          url: url!,
          enabled,
          events,
          webhookByEvents: false,
          webhookBase64: false,
        },
      });

      const waInstance = this.waMonitor.waInstances[instance.instanceName];
      if (waInstance?.localWebhook) {
        waInstance.localWebhook.enabled = enabled;
        if (url) waInstance.localWebhook.url = url;
        waInstance.localWebhook.events = events;
      }
    }

    return this.find(instance);
  }

  public async isPassthroughEnabledForInstance(instanceName: string): Promise<boolean> {
    const globalEnabled = this.configService.get<WaBusiness>('WA_BUSINESS').WEBHOOK_PASSTHROUGH === true;
    if (globalEnabled) return true;

    const instance = await this.prismaRepository.instance.findUnique({
      where: { name: instanceName },
      include: { Setting: true },
    });

    return instance?.Setting?.metaWebhookPassthrough === true;
  }
}
