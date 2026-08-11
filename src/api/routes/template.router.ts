import { RouterBroker } from '@api/abstract/abstract.router';
import { InstanceDto } from '@api/dto/instance.dto';
import { MetaWebhookConfigDto } from '@api/dto/metaWebhookConfig.dto';
import { TemplateDeleteDto, TemplateDto, TemplateEditDto, TemplateFindByIdDto } from '@api/dto/template.dto';
import { templateController } from '@api/server.module';
import { ConfigService } from '@config/env.config';
import { createMetaErrorResponse } from '@utils/errorResponse';
import { metaWebhookConfigSchema } from '@validate/metaWebhookConfig.schema';
import { templateDeleteSchema } from '@validate/templateDelete.schema';
import { templateEditSchema } from '@validate/templateEdit.schema';
import { templateFindByIdSchema } from '@validate/templateFindById.schema';
import { instanceSchema, templateSchema } from '@validate/validate.schema';
import { RequestHandler, Router } from 'express';

import { HttpStatus } from './index.router';

/**
 * WhatsApp Business message template routes (Meta Graph API).
 *
 * Endpoints:
 * - POST   /template/create/:instanceName
 * - POST   /template/edit/:instanceName
 * - DELETE /template/delete/:instanceName
 * - GET    /template/find/:instanceName
 * - GET    /template/findById/:instanceName?templateId=
 * - GET    /template/status/:instanceName?templateId=
 * - GET    /template/metaWebhook/:instanceName
 * - POST   /template/metaWebhook/:instanceName
 *
 * Docs: docs/meta-templates.md
 */
export class TemplateRouter extends RouterBroker {
  constructor(
    readonly configService: ConfigService,
    ...guards: RequestHandler[]
  ) {
    super();
    this.router
      .post(this.routerPath('create'), ...guards, async (req, res) => {
        try {
          const response = await this.dataValidate<TemplateDto>({
            request: req,
            schema: templateSchema,
            ClassRef: TemplateDto,
            execute: (instance, data) => templateController.createTemplate(instance, data),
          });

          res.status(HttpStatus.CREATED).json(response);
        } catch (error) {
          console.error('Template creation error:', error);
          const errorResponse = createMetaErrorResponse(error, 'template_creation');
          res.status(errorResponse.status).json(errorResponse);
        }
      })
      .post(this.routerPath('edit'), ...guards, async (req, res) => {
        try {
          const response = await this.dataValidate<TemplateEditDto>({
            request: req,
            schema: templateEditSchema,
            ClassRef: TemplateEditDto,
            execute: (instance, data) => templateController.editTemplate(instance, data),
          });

          res.status(HttpStatus.OK).json(response);
        } catch (error) {
          console.error('Template edit error:', error);
          const errorResponse = createMetaErrorResponse(error, 'template_edit');
          res.status(errorResponse.status).json(errorResponse);
        }
      })
      .delete(this.routerPath('delete'), ...guards, async (req, res) => {
        try {
          const response = await this.dataValidate<TemplateDeleteDto>({
            request: req,
            schema: templateDeleteSchema,
            ClassRef: TemplateDeleteDto,
            execute: (instance, data) => templateController.deleteTemplate(instance, data),
          });

          res.status(HttpStatus.OK).json(response);
        } catch (error) {
          console.error('Template delete error:', error);
          const errorResponse = createMetaErrorResponse(error, 'template_delete');
          res.status(errorResponse.status).json(errorResponse);
        }
      })
      .get(this.routerPath('find'), ...guards, async (req, res) => {
        try {
          const response = await this.dataValidate<InstanceDto>({
            request: req,
            schema: instanceSchema,
            ClassRef: InstanceDto,
            execute: (instance) =>
              templateController.findTemplate(instance, {
                status: req.query.status as string,
                limit: req.query.limit as string,
                after: req.query.after as string,
                before: req.query.before as string,
                name: req.query.name as string,
                language: req.query.language as string,
                category: req.query.category as string,
                fields: req.query.fields as string,
              }),
          });

          res.status(HttpStatus.OK).json(response);
        } catch (error) {
          console.error('Template find error:', error);
          const errorResponse = createMetaErrorResponse(error, 'template_find');
          res.status(errorResponse.status).json(errorResponse);
        }
      })
      .get(this.routerPath('findById'), ...guards, async (req, res) => {
        try {
          req.body = {
            templateId: req.query.templateId,
            fields: req.query.fields,
          };

          const response = await this.dataValidate<TemplateFindByIdDto>({
            request: req,
            schema: templateFindByIdSchema,
            ClassRef: TemplateFindByIdDto,
            execute: (instance, data) => templateController.findTemplateById(instance, data),
          });

          res.status(HttpStatus.OK).json(response);
        } catch (error) {
          console.error('Template findById error:', error);
          const errorResponse = createMetaErrorResponse(error, 'template_find_by_id');
          res.status(errorResponse.status).json(errorResponse);
        }
      })
      .get(this.routerPath('status'), ...guards, async (req, res) => {
        try {
          req.body = {
            templateId: req.query.templateId,
            fields: req.query.fields,
          };

          const response = await this.dataValidate<TemplateFindByIdDto>({
            request: req,
            schema: templateFindByIdSchema,
            ClassRef: TemplateFindByIdDto,
            execute: (instance, data) => templateController.findTemplateStatus(instance, data),
          });

          res.status(HttpStatus.OK).json(response);
        } catch (error) {
          console.error('Template status error:', error);
          const errorResponse = createMetaErrorResponse(error, 'template_status');
          res.status(errorResponse.status).json(errorResponse);
        }
      })
      .get(this.routerPath('metaWebhook'), ...guards, async (req, res) => {
        try {
          const response = await this.dataValidate<InstanceDto>({
            request: req,
            schema: instanceSchema,
            ClassRef: InstanceDto,
            execute: (instance) => templateController.findMetaWebhookConfig(instance),
          });

          res.status(HttpStatus.OK).json(response);
        } catch (error) {
          console.error('Meta webhook config find error:', error);
          const errorResponse = createMetaErrorResponse(error, 'meta_webhook_config_find');
          res.status(errorResponse.status).json(errorResponse);
        }
      })
      .post(this.routerPath('metaWebhook'), ...guards, async (req, res) => {
        try {
          const response = await this.dataValidate<MetaWebhookConfigDto>({
            request: req,
            schema: metaWebhookConfigSchema,
            ClassRef: MetaWebhookConfigDto,
            execute: (instance, data) => templateController.updateMetaWebhookConfig(instance, data),
          });

          res.status(HttpStatus.OK).json(response);
        } catch (error) {
          console.error('Meta webhook config update error:', error);
          const errorResponse = createMetaErrorResponse(error, 'meta_webhook_config_update');
          res.status(errorResponse.status).json(errorResponse);
        }
      });
  }

  public readonly router: Router = Router();
}
