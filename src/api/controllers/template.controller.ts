import { InstanceDto } from '@api/dto/instance.dto';
import { MetaWebhookConfigDto } from '@api/dto/metaWebhookConfig.dto';
import { TemplateDto, TemplateFindByIdDto, TemplateFindDto } from '@api/dto/template.dto';
import { MetaWebhookConfigService } from '@api/services/metaWebhookConfig.service';
import { TemplateService } from '@api/services/template.service';

/**
 * Thin controller for Meta message template CRUD/status operations
 * and Meta webhook configuration for the Manager UI.
 */
export class TemplateController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly metaWebhookConfigService: MetaWebhookConfigService,
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
}
