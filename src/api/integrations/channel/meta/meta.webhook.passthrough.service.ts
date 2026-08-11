import { EventManager } from '@api/integrations/event/event.manager';
import { PrismaRepository } from '@api/repository/repository.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { Events } from '@api/types/wa.types';
import { Auth, ConfigService, HttpServer } from '@config/env.config';
import { Logger } from '@config/logger.config';

export type MetaPassthroughMode = 'dedicated' | 'sidecar';

/**
 * Optional Meta webhook passthrough.
 *
 * Forwards Meta WhatsApp Business Account webhook payloads using Meta's own
 * schema (object/entry/changes) to the configured Evolution webhook/event
 * integrations as META_WEBHOOK (`meta.webhook`).
 */
export class MetaWebhookPassthroughService {
  private readonly logger = new Logger('MetaWebhookPassthroughService');

  constructor(
    private readonly prismaRepository: PrismaRepository,
    private readonly waMonitor: WAMonitoringService,
    private readonly configService: ConfigService,
    private readonly eventManager: EventManager,
  ) {}

  private extractPhoneNumberId(value: any): string | undefined {
    return (
      value?.metadata?.phone_number_id ||
      value?.phone_number_id ||
      value?.display_phone_number_id ||
      value?.phone_number?.id ||
      undefined
    );
  }

  private extractWabaIds(entry: any, value: any): string[] {
    const ids = new Set<string>();
    if (entry?.id) ids.add(`${entry.id}`);
    if (value?.waba_info?.waba_id) ids.add(`${value.waba_info.waba_id}`);
    if (value?.waba_id) ids.add(`${value.waba_id}`);
    if (value?.whatsapp_business_account_id) ids.add(`${value.whatsapp_business_account_id}`);
    return [...ids];
  }

  private async resolveInstanceNames(entry: any, change: any): Promise<string[]> {
    const value = change?.value || {};
    const names = new Set<string>();

    const phoneNumberId = this.extractPhoneNumberId(value);
    if (phoneNumberId) {
      const byNumber = await this.prismaRepository.instance.findFirst({
        where: { number: `${phoneNumberId}` },
      });
      if (byNumber?.name) names.add(byNumber.name);
    }

    const wabaIds = this.extractWabaIds(entry, value);
    if (wabaIds.length > 0) {
      const byBusiness = await this.prismaRepository.instance.findMany({
        where: { businessId: { in: wabaIds } },
      });
      for (const instance of byBusiness) {
        if (instance?.name) names.add(instance.name);
      }
    }

    return [...names];
  }

  private async emitRaw(instanceName: string, payload: Record<string, unknown>) {
    const serverUrl = this.configService.get<HttpServer>('SERVER').URL;
    const expose = this.configService.get<Auth>('AUTHENTICATION').EXPOSE_IN_FETCH_INSTANCES;
    const waInstance = this.waMonitor.waInstances[instanceName];
    const instanceApikey = waInstance?.token || null;
    const tzoffset = new Date().getTimezoneOffset() * 60000;
    const dateTime = new Date(Date.now() - tzoffset).toISOString();

    await this.eventManager.emit({
      instanceName,
      origin: MetaWebhookPassthroughService.name,
      event: Events.META_WEBHOOK,
      data: payload,
      serverUrl,
      dateTime,
      sender: waInstance?.wuid || instanceName,
      apiKey: expose && instanceApikey ? instanceApikey : null,
      local: true,
    });
  }

  /**
   * Forward every Meta change using Meta's native webhook schema.
   * Returns how many instance deliveries were attempted.
   */
  public async forward(data: any, mode: MetaPassthroughMode = 'dedicated'): Promise<number> {
    if (data?.object !== 'whatsapp_business_account') {
      return 0;
    }

    let delivered = 0;

    for (const entry of data.entry || []) {
      for (const change of entry.changes || []) {
        const instanceNames = await this.resolveInstanceNames(entry, change);

        if (instanceNames.length === 0) {
          this.logger.warn(`Meta passthrough skipped: no instance found for field=${change?.field} entry=${entry?.id}`);
          continue;
        }

        // Preserve Meta schema shape (object + entry + changes)
        const metaSchemaPayload = {
          object: data.object,
          entry: [
            {
              id: entry.id,
              time: entry.time,
              changes: [change],
            },
          ],
          // Evolution helper metadata (non-breaking additions for routing/debug)
          _evolution: {
            mode,
            field: change?.field,
            wabaId: entry?.id,
            receivedAt: new Date().toISOString(),
          },
        };

        for (const instanceName of instanceNames) {
          await this.emitRaw(instanceName, metaSchemaPayload);
          delivered += 1;
        }
      }
    }

    return delivered;
  }
}
