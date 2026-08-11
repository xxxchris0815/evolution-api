import { EventManager } from '@api/integrations/event/event.manager';
import { PrismaRepository } from '@api/repository/repository.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { ConfigService } from '@config/env.config';
import { Logger } from '@config/logger.config';

import { ChannelController, ChannelControllerInterface } from '../channel.controller';
import { isTemplateWebhookField, MetaTemplateWebhookService } from './meta.template.webhook.service';

export class MetaController extends ChannelController implements ChannelControllerInterface {
  private readonly logger = new Logger('MetaController');
  private readonly templateWebhookService: MetaTemplateWebhookService;

  constructor(
    prismaRepository: PrismaRepository,
    waMonitor: WAMonitoringService,
    configService: ConfigService,
    eventManager: EventManager,
  ) {
    super(prismaRepository, waMonitor);
    this.templateWebhookService = new MetaTemplateWebhookService(
      prismaRepository,
      waMonitor,
      configService,
      eventManager,
    );
  }

  integrationEnabled: boolean;

  public async receiveWebhook(data: any) {
    if (data.object !== 'whatsapp_business_account') {
      return { status: 'success' };
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
          await this.waMonitor.waInstances[instance.name].connectToWhatsapp(data);
        }
      }
    }

    return {
      status: 'success',
    };
  }
}
