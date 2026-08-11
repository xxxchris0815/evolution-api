import { InstanceDto } from '@api/dto/instance.dto';
import { MetaWebhookConfigDto } from '@api/dto/metaWebhookConfig.dto';
import { TemplateDto, TemplateFindByIdDto, TemplateFindDto } from '@api/dto/template.dto';
import { ChatwootTemplateSyncService } from '@api/integrations/chatbot/chatwoot/services/chatwoot.template.sync.service';
import { MetaWebhookConfigService } from '@api/services/metaWebhookConfig.service';
import { TemplateService } from '@api/services/template.service';

/**
 * Thin controller for Meta message template CRUD/status operations,
 * Meta webhook configuration, and Chatwoot template sync.
 */
export class TemplateController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly metaWebhookConfigService: MetaWebhookConfigService,
    private readonly chatwootTemplateSyncService: ChatwootTemplateSyncService,
  ) {}

  public async createTemplate(instance: InstanceDto, data: TemplateDto) {
    return this.templateService.create(instance, data);
  }

  public async findTemplate(instance: InstanceDto, filters: TemplateFindDto = {}) {
    return this.templateService.find(instance, filters);
  }

  public async findTemplateById(instance: InstanceDto, data: TemplateFindByIdDto) {
    return this.templateService.findById(instance, data);
  }

  public async findTemplateStatus(instance: InstanceDto, data: TemplateFindByIdDto) {
    return this.templateService.findById(instance, {
      templateId: data.templateId,
      fields: data.fields || 'id,name,status,rejected_reason,quality_score,category',
    });
  }

  public async editTemplate(
    instance: InstanceDto,
    data: { templateId: string; category?: string; components?: any; allowCategoryChange?: boolean; ttl?: number },
  ) {
    return this.templateService.edit(instance, data);
  }

  public async deleteTemplate(instance: InstanceDto, data: { name: string; hsmId?: string }) {
    return this.templateService.delete(instance, data);
  }

  public async findMetaWebhookConfig(instance: InstanceDto) {
    return this.metaWebhookConfigService.find(instance);
  }

  public async updateMetaWebhookConfig(instance: InstanceDto, data: MetaWebhookConfigDto) {
    return this.metaWebhookConfigService.update(instance, data);
  }

  public async syncChatwootTemplates(instance: InstanceDto) {
    return this.chatwootTemplateSyncService.sync(instance);
  }
}
