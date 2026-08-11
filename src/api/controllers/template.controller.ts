import { InstanceDto } from '@api/dto/instance.dto';
import { TemplateDto, TemplateFindByIdDto, TemplateFindDto } from '@api/dto/template.dto';
import { TemplateService } from '@api/services/template.service';

export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

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
}
