import { ChatwootService } from '@api/integrations/chatbot/chatwoot/services/chatwoot.service';
import { EventManager } from '@api/integrations/event/event.manager';
import { PrismaRepository } from '@api/repository/repository.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { ConfigService } from '@config/env.config';
import { Logger } from '@config/logger.config';

import { ChannelController, ChannelControllerInterface } from '../channel.controller';
import { isTemplateWebhookField, MetaTemplateWebhookService } from './meta.template.webhook.service';
import { MetaWebhookPassthroughService } from './meta.webhook.passthrough.service';

export class MetaController extends ChannelController implements ChannelControllerInterface {
  private readonly logger = new Logger('MetaController');
  private readonly templateWebhookService: MetaTemplateWebhookService;
  private readonly passthroughService: MetaWebhookPassthroughService;

  constructor(
    prismaRepository: PrismaRepository,
    waMonitor: WAMonitoringService,
    configService: ConfigService,
    eventManager: EventManager,
    chatwootService?: ChatwootService,
  ) {
    super(prismaRepository, waMonitor);
    this.templateWebhookService = new MetaTemplateWebhookService(
      prismaRepository,
      waMonitor,
      configService,
      eventManager,
      chatwootService,
    );
    this.passthroughService = new MetaWebhookPassthroughService(
      prismaRepository,
      waMonitor,
      configService,
      eventManager,
    );
  }

  integrationEnabled: boolean;

  /**
   * Dedicated raw Meta webhook endpoint handler.
   * Forwards Meta payloads using Meta's schema to configured Evolution webhooks.
   */
  public async receiveWebhookPassthrough(data: any) {
    const delivered = await this.passthroughService.forward(data, 'dedicated');
    return {
      status: 'success',
      mode: 'passthrough',
      delivered,
    };
  }

  public async receiveWebhook(data: any) {
    if (data.object !== 'whatsapp_business_account') {
      return { status: 'success' };
    }

    // Optional sidecar: forward raw Meta schema for instances with passthrough enabled
    // (per-instance setting and/or WA_BUSINESS_WEBHOOK_PASSTHROUGH=true)
    try {
      await this.passthroughService.forward(data, 'sidecar');
    } catch (error) {
      this.logger.error(`Meta webhook passthrough sidecar failed: ${(error as Error).message}`);
    }

    for (const entry of data.entry || []) {
      for (const change of entry.changes || []) {
        if (isTemplateWebhookField(change?.field)) {
          await this.templateWebhookService.handle(change, entry.id);
          continue;
        }

        const numberId = change?.value?.metadata?.phone_number_id;

        if (!numberId) {
          this.logger.error('WebhookService -> receiveWebhookMeta -> numberId not found');
          continue;
        }

        const instance = await this.prismaRepository.instance.findFirst({
          where: { number: numberId },
        });

        if (!instance) {
          this.logger.error('WebhookService -> receiveWebhookMeta -> instance not found');
          continue;
        }

        if (this.waMonitor.waInstances[instance.name]) {
          // Pass only the matched change value. Using the full webhook body always
          // selected entry[0].changes[0], which dropped later status updates.
          await this.waMonitor.waInstances[instance.name].connectToWhatsapp({
            entry: [
              {
                id: entry.id,
                changes: [
                  {
                    field: change.field,
                    value: change.value,
                  },
                ],
              },
            ],
          });
        }
      }
    }

    return {
      status: 'success',
    };
  }
}
