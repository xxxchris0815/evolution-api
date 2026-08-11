import { InstanceDto } from '@api/dto/instance.dto';
import { TemplateDto, TemplateFindByIdDto, TemplateFindDto } from '@api/dto/template.dto';
import { PrismaRepository } from '@api/repository/repository.service';
import { ConfigService, WaBusiness } from '@config/env.config';
import { Logger } from '@config/logger.config';
import axios, { AxiosRequestConfig } from 'axios';

import { WAMonitoringService } from './monitor.service';

export class TemplateService {
  constructor(
    private readonly waMonitor: WAMonitoringService,
    public readonly prismaRepository: PrismaRepository,
    private readonly configService: ConfigService,
  ) {}

  private readonly logger = new Logger('TemplateService');

  private businessId: string;
  private token: string;

  private get graphConfig() {
    const waBusiness = this.configService.get<WaBusiness>('WA_BUSINESS');
    return {
      url: waBusiness.URL,
      version: waBusiness.VERSION,
    };
  }

  private get authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` };
  }

  private throwMetaError(response: any, fallbackMessage: string) {
    if (response?.error) {
      const metaError = new Error(response.error.message || 'WhatsApp API Error');
      (metaError as any).template = response.error;
      throw metaError;
    }
    throw new Error(fallbackMessage);
  }

  private async loadInstanceCredentials(instance: InstanceDto) {
    const getInstance = await this.waMonitor.waInstances[instance.instanceName]?.instance;

    if (!getInstance) {
      throw new Error('Instance not found');
    }

    this.businessId = getInstance.businessId;
    this.token = getInstance.token;

    return getInstance;
  }

  public async find(instance: InstanceDto, filters: TemplateFindDto = {}) {
    await this.loadInstanceCredentials(instance);

    const response = await this.requestTemplate({}, 'GET', filters);

    if (!response || response.error) {
      this.throwMetaError(response, 'Error to find templates');
    }

    return response;
  }

  public async findById(instance: InstanceDto, data: TemplateFindByIdDto) {
    await this.loadInstanceCredentials(instance);

    const fields =
      data.fields ||
      'id,name,status,category,language,components,rejected_reason,quality_score,previous_category,parameter_format';

    const response = await this.requestTemplateById(data.templateId, fields);

    if (!response || response.error) {
      this.throwMetaError(response, 'Error to find template by id');
    }

    return response;
  }

  public async create(instance: InstanceDto, data: TemplateDto) {
    try {
      const getInstance = await this.loadInstanceCredentials(instance);

      const postData: Record<string, unknown> = {
        name: data.name,
        category: data.category,
        allow_category_change: data.allowCategoryChange,
        language: data.language,
        components: data.components,
      };

      if (data.parameterFormat) {
        postData.parameter_format = data.parameterFormat;
      }

      if (data.libraryTemplateName) {
        postData.library_template_name = data.libraryTemplateName;
      }

      if (data.libraryTemplateButtonInputs) {
        postData.library_template_button_inputs = data.libraryTemplateButtonInputs;
      }

      const response = await this.requestTemplate(postData, 'POST');

      if (!response || response.error) {
        this.throwMetaError(response, 'Error to create template');
      }

      const template = await this.prismaRepository.template.create({
        data: {
          templateId: response.id,
          name: data.name,
          template: response,
          webhookUrl: data.webhookUrl,
          instanceId: getInstance.id,
        },
      });

      return template;
    } catch (error) {
      this.logger.error('Error in create template: ' + error);
      throw error;
    }
  }

  public async edit(
    instance: InstanceDto,
    data: { templateId: string; category?: string; components?: any; allowCategoryChange?: boolean; ttl?: number },
  ) {
    const getInstance = await this.loadInstanceCredentials(instance);

    const payload: Record<string, unknown> = {};
    if (typeof data.category === 'string') payload.category = data.category;
    if (typeof data.allowCategoryChange === 'boolean') payload.allow_category_change = data.allowCategoryChange;
    if (typeof data.ttl === 'number') payload.time_to_live = data.ttl;
    if (data.components) payload.components = data.components;

    const response = await this.requestEditTemplate(data.templateId, payload);

    if (!response || response.error) {
      this.throwMetaError(response, 'Error to edit template');
    }

    try {
      const existing = await this.prismaRepository.template.findFirst({
        where: { templateId: data.templateId, instanceId: getInstance.id },
      });

      if (existing) {
        const currentTemplate =
          existing.template && typeof existing.template === 'object'
            ? (existing.template as Record<string, unknown>)
            : {};

        await this.prismaRepository.template.update({
          where: { id: existing.id },
          data: {
            template: {
              ...currentTemplate,
              ...payload,
              id: data.templateId,
              ...(response || {}),
            },
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to sync local template after edit: ${(err as Error)?.message || String(err)}`);
    }

    return response;
  }

  public async delete(instance: InstanceDto, data: { name: string; hsmId?: string }) {
    const getInstance = await this.loadInstanceCredentials(instance);

    const response = await this.requestDeleteTemplate({ name: data.name, hsm_id: data.hsmId });

    if (!response || response.error) {
      this.throwMetaError(response, 'Error to delete template');
    }

    try {
      await this.prismaRepository.template.deleteMany({
        where: {
          OR: [
            { name: data.name, instanceId: getInstance.id },
            data.hsmId ? { templateId: data.hsmId, instanceId: getInstance.id } : undefined,
          ].filter(Boolean) as any,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to cleanup local template records after delete: ${(err as Error)?.message || String(err)}`,
      );
    }

    return response;
  }

  private async requestTemplate(data: any, method: string, filters: TemplateFindDto = {}) {
    try {
      const { url, version } = this.graphConfig;
      const urlServer = `${url}/${version}/${this.businessId}/message_templates`;
      const headers = this.authHeaders;

      if (method === 'GET') {
        const params: Record<string, string | number> = {};
        if (filters.status) params.status = filters.status;
        if (filters.limit) params.limit = Number(filters.limit);
        if (filters.after) params.after = filters.after;
        if (filters.before) params.before = filters.before;
        if (filters.name) params.name = filters.name;
        if (filters.language) params.language = filters.language;
        if (filters.category) params.category = filters.category;
        if (filters.fields) params.fields = filters.fields;

        const config: AxiosRequestConfig = { headers, params };
        const result = await axios.get(urlServer, config);
        return result.data;
      }

      if (method === 'POST') {
        const result = await axios.post(urlServer, data, { headers });
        return result.data;
      }
    } catch (e) {
      this.logger.error(
        'WhatsApp API request error: ' + (e.response?.data ? JSON.stringify(e.response?.data) : e.message),
      );

      if (e.response?.data) {
        return e.response.data;
      }

      throw new Error(`Connection error: ${e.message}`);
    }
  }

  private async requestTemplateById(templateId: string, fields: string) {
    try {
      const { url, version } = this.graphConfig;
      const urlServer = `${url}/${version}/${templateId}`;
      const result = await axios.get(urlServer, {
        headers: this.authHeaders,
        params: { fields },
      });
      return result.data;
    } catch (e) {
      this.logger.error(
        'WhatsApp API request error: ' + (e.response?.data ? JSON.stringify(e.response?.data) : e.message),
      );
      if (e.response?.data) return e.response.data;
      throw new Error(`Connection error: ${e.message}`);
    }
  }

  private async requestEditTemplate(templateId: string, data: any) {
    try {
      const { url, version } = this.graphConfig;
      const urlServer = `${url}/${version}/${templateId}`;
      const result = await axios.post(urlServer, data, { headers: this.authHeaders });
      return result.data;
    } catch (e) {
      this.logger.error(
        'WhatsApp API request error: ' + (e.response?.data ? JSON.stringify(e.response?.data) : e.message),
      );
      if (e.response?.data) return e.response.data;
      throw new Error(`Connection error: ${e.message}`);
    }
  }

  private async requestDeleteTemplate(params: { name: string; hsm_id?: string }) {
    try {
      const { url, version } = this.graphConfig;
      const urlServer = `${url}/${version}/${this.businessId}/message_templates`;
      const result = await axios.delete(urlServer, {
        headers: { Authorization: `Bearer ${this.token}` },
        params,
      });
      return result.data;
    } catch (e) {
      this.logger.error(
        'WhatsApp API request error: ' + (e.response?.data ? JSON.stringify(e.response?.data) : e.message),
      );
      if (e.response?.data) return e.response.data;
      throw new Error(`Connection error: ${e.message}`);
    }
  }
}
