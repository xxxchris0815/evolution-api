import { EventManager } from '@api/integrations/event/event.manager';
import { PrismaRepository } from '@api/repository/repository.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { Events } from '@api/types/wa.types';
import { Auth, ConfigService, HttpServer } from '@config/env.config';
import { Logger } from '@config/logger.config';
import axios from 'axios';

const TEMPLATE_WEBHOOK_FIELDS = new Set([
  'message_template_status_update',
  'message_template_quality_update',
  'template_category_update',
  'message_template_components_update',
]);

export function isTemplateWebhookField(field?: string): boolean {
  return !!field && TEMPLATE_WEBHOOK_FIELDS.has(field);
}

export class MetaTemplateWebhookService {
  private readonly logger = new Logger('MetaTemplateWebhookService');

  constructor(
    private readonly prismaRepository: PrismaRepository,
    private readonly waMonitor: WAMonitoringService,
    private readonly configService: ConfigService,
    private readonly eventManager: EventManager,
  ) {}

  private mapTemplateEvent(field: string): Events {
    switch (field) {
      case 'message_template_quality_update':
        return Events.TEMPLATE_QUALITY_UPDATE;
      case 'template_category_update':
        return Events.TEMPLATE_CATEGORY_UPDATE;
      case 'message_template_components_update':
        return Events.TEMPLATE_COMPONENTS_UPDATE;
      case 'message_template_status_update':
      default:
        return Events.TEMPLATE_STATUS_UPDATE;
    }
  }

  private async emitTemplateEvent(instanceName: string, event: Events, data: Record<string, unknown>) {
    const serverUrl = this.configService.get<HttpServer>('SERVER').URL;
    const expose = this.configService.get<Auth>('AUTHENTICATION').EXPOSE_IN_FETCH_INSTANCES;
    const waInstance = this.waMonitor.waInstances[instanceName];
    const instanceApikey = waInstance?.token || null;
    const tzoffset = new Date().getTimezoneOffset() * 60000;
    const dateTime = new Date(Date.now() - tzoffset).toISOString();

    await this.eventManager.emit({
      instanceName,
      origin: MetaTemplateWebhookService.name,
      event,
      data,
      serverUrl,
      dateTime,
      sender: waInstance?.wuid || instanceName,
      apiKey: expose && instanceApikey ? instanceApikey : null,
      local: true,
    });
  }

  public async handle(change: any, entryId?: string) {
    const field = change?.field;
    const value = change?.value || {};

    if (!value.message_template_id && !value.message_template_name) {
      this.logger.warn(`Template webhook received without template id for field ${field}`);
      return;
    }

    const orFilters = [
      value.message_template_id ? { templateId: `${value.message_template_id}` } : undefined,
      value.message_template_name ? { name: value.message_template_name } : undefined,
    ].filter(Boolean) as Array<Record<string, string>>;

    const template = await this.prismaRepository.template.findFirst({
      where: { OR: orFilters },
      include: { Instance: true },
    });

    const event = this.mapTemplateEvent(field);
    const payload = {
      field,
      ...value,
      wabaId: entryId,
    };

    if (template) {
      try {
        const currentTemplate =
          template.template && typeof template.template === 'object'
            ? (template.template as Record<string, unknown>)
            : {};

        await this.prismaRepository.template.update({
          where: { id: template.id },
          data: {
            template: {
              ...currentTemplate,
              id: value.message_template_id || currentTemplate.id || template.templateId,
              name: value.message_template_name || currentTemplate.name || template.name,
              status: value.event || value.message_template_status || currentTemplate.status,
              quality_score: value.message_template_quality || value.quality_score || currentTemplate.quality_score,
              previous_category: value.previous_category || currentTemplate.previous_category,
              category: value.new_category || value.category || currentTemplate.category,
              rejected_reason: value.reason || currentTemplate.rejected_reason,
              last_webhook: payload,
            },
          },
        });
      } catch (error) {
        this.logger.error(`Failed to persist template webhook update: ${(error as Error).message}`);
      }

      if (template.webhookUrl) {
        try {
          await axios.post(template.webhookUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          this.logger.error(`Failed to forward template webhookUrl: ${(error as Error).message}`);
        }
      }

      const instanceName = template.Instance?.name;
      if (instanceName) {
        await this.emitTemplateEvent(instanceName, event, payload);
        return;
      }
    }

    if (entryId) {
      const instance = await this.prismaRepository.instance.findFirst({
        where: { businessId: `${entryId}` },
      });

      if (instance) {
        await this.emitTemplateEvent(instance.name, event, payload);
      } else {
        this.logger.warn(`No instance found for template webhook WABA ${entryId}`);
      }
    }
  }
}
