import { InstanceDto } from '@api/dto/instance.dto';
import { PrismaRepository } from '@api/repository/repository.service';
import { TemplateService } from '@api/services/template.service';
import { Logger } from '@config/logger.config';
import {
  buildMetaCannedContent,
  buildMetaCannedShortCode,
  isMetaManagedCannedShortCode,
  META_CANNED_PREFIX,
  MetaTemplatePayload,
} from '@utils/chatwoot-template.helper';
import axios from 'axios';

type CannedResponse = {
  id: number;
  short_code: string;
  content: string;
  account_id?: number;
};

/**
 * Bidirectional-friendly sync between Meta approved templates and Chatwoot canned responses.
 *
 * - Meta templates → Chatwoot canned responses prefixed with `meta_` and marked [META:readonly]
 * - User-owned Chatwoot canned responses (no meta_ prefix) are never modified/deleted
 * - Local Prisma Template rows store source/readOnly metadata
 */
export class ChatwootTemplateSyncService {
  private readonly logger = new Logger('ChatwootTemplateSyncService');

  constructor(
    private readonly prismaRepository: PrismaRepository,
    private readonly templateService: TemplateService,
  ) {}

  private async getChatwootConfig(instanceName: string) {
    const instance = await this.prismaRepository.instance.findUnique({
      where: { name: instanceName },
      include: { Chatwoot: true },
    });

    if (!instance) {
      throw new Error('Instance not found');
    }

    if (
      !instance.Chatwoot?.enabled ||
      !instance.Chatwoot.url ||
      !instance.Chatwoot.accountId ||
      !instance.Chatwoot.token
    ) {
      throw new Error('Chatwoot is not configured for this instance');
    }

    return {
      instance,
      chatwoot: instance.Chatwoot,
      baseUrl: `${instance.Chatwoot.url.replace(/\/$/, '')}/api/v1/accounts/${instance.Chatwoot.accountId}`,
      headers: {
        api_access_token: instance.Chatwoot.token,
        'Content-Type': 'application/json',
      },
    };
  }

  private async listCannedResponses(baseUrl: string, headers: Record<string, string>): Promise<CannedResponse[]> {
    const { data } = await axios.get(baseUrl + '/canned_responses', { headers });
    return Array.isArray(data) ? data : [];
  }

  private async upsertCannedResponse(
    baseUrl: string,
    headers: Record<string, string>,
    existing: CannedResponse | undefined,
    shortCode: string,
    content: string,
  ): Promise<CannedResponse> {
    if (existing?.id) {
      const { data } = await axios.patch(
        `${baseUrl}/canned_responses/${existing.id}`,
        { content, short_code: shortCode },
        { headers },
      );
      return data;
    }

    const { data } = await axios.post(`${baseUrl}/canned_responses`, { short_code: shortCode, content }, { headers });
    return data;
  }

  private async deleteCannedResponse(baseUrl: string, headers: Record<string, string>, id: number) {
    await axios.delete(`${baseUrl}/canned_responses/${id}`, { headers });
  }

  private toPayload(metaTemplate: any): MetaTemplatePayload {
    return {
      source: 'meta',
      readOnly: true,
      name: metaTemplate.name,
      language: metaTemplate.language || 'en_US',
      category: metaTemplate.category,
      status: metaTemplate.status,
      metaTemplateId: `${metaTemplate.id}`,
      components: metaTemplate.components || [],
    };
  }

  /**
   * Pull Meta templates into local DB and push APPROVED ones into Chatwoot as read-only canned responses.
   * Also imports non-meta Chatwoot canned responses into local DB as source=chatwoot (editable).
   */
  public async sync(instance: InstanceDto) {
    const { instance: dbInstance, baseUrl, headers } = await this.getChatwootConfig(instance.instanceName);

    const metaList = await this.templateService.find(instance, { limit: '1000' });
    const metaTemplates: any[] = Array.isArray(metaList?.data) ? metaList.data : [];

    const canned = await this.listCannedResponses(baseUrl, headers);
    const cannedByShortCode = new Map(canned.map((item) => [item.short_code, item]));

    const syncedMeta: Array<Record<string, unknown>> = [];
    const keptMetaShortCodes = new Set<string>();

    for (const metaTemplate of metaTemplates) {
      const payload = this.toPayload(metaTemplate);
      const shortCode = buildMetaCannedShortCode(payload.metaTemplateId, payload.name, payload.language);
      keptMetaShortCodes.add(shortCode);

      const local = await this.prismaRepository.template.upsert({
        where: { templateId: payload.metaTemplateId },
        create: {
          templateId: payload.metaTemplateId,
          name: payload.name,
          template: metaTemplate,
          instanceId: dbInstance.id,
          source: 'meta',
          readOnly: true,
          language: payload.language,
          status: payload.status,
          category: payload.category,
        },
        update: {
          name: payload.name,
          template: metaTemplate,
          source: 'meta',
          readOnly: true,
          language: payload.language,
          status: payload.status,
          category: payload.category,
        },
      });

      let chatwootCannedId = local.chatwootCannedId;

      if (`${payload.status}`.toUpperCase() === 'APPROVED') {
        const content = buildMetaCannedContent(payload);
        const existing =
          cannedByShortCode.get(shortCode) ||
          (local.chatwootCannedId ? canned.find((item) => `${item.id}` === `${local.chatwootCannedId}`) : undefined);

        const saved = await this.upsertCannedResponse(baseUrl, headers, existing, shortCode, content);
        chatwootCannedId = `${saved.id}`;

        await this.prismaRepository.template.update({
          where: { id: local.id },
          data: { chatwootCannedId },
        });
      } else if (local.chatwootCannedId) {
        // Non-approved Meta templates should not remain selectable in Chatwoot
        const existing = canned.find((item) => `${item.id}` === `${local.chatwootCannedId}`);
        if (existing && isMetaManagedCannedShortCode(existing.short_code)) {
          await this.deleteCannedResponse(baseUrl, headers, existing.id);
        }
        await this.prismaRepository.template.update({
          where: { id: local.id },
          data: { chatwootCannedId: null },
        });
        chatwootCannedId = null;
      }

      syncedMeta.push({
        templateId: payload.metaTemplateId,
        name: payload.name,
        language: payload.language,
        status: payload.status,
        shortCode,
        chatwootCannedId,
        readOnly: true,
        source: 'meta',
      });
    }

    // Remove stale meta_* canned responses no longer present/approved
    for (const item of canned) {
      if (!isMetaManagedCannedShortCode(item.short_code)) continue;
      if (keptMetaShortCodes.has(item.short_code)) continue;
      await this.deleteCannedResponse(baseUrl, headers, item.id);
    }

    // Import user-owned Chatwoot canned responses as editable local records (not pushed to Meta)
    const refreshedCanned = await this.listCannedResponses(baseUrl, headers);
    const importedChatwoot: Array<Record<string, unknown>> = [];

    for (const item of refreshedCanned) {
      if (isMetaManagedCannedShortCode(item.short_code)) continue;

      const localId = `chatwoot:${dbInstance.id}:${item.id}`;
      const saved = await this.prismaRepository.template.upsert({
        where: { templateId: localId },
        create: {
          templateId: localId,
          name: item.short_code,
          template: {
            source: 'chatwoot',
            short_code: item.short_code,
            content: item.content,
            chatwootCannedId: item.id,
          },
          instanceId: dbInstance.id,
          source: 'chatwoot',
          readOnly: false,
          status: 'LOCAL',
          chatwootCannedId: `${item.id}`,
        },
        update: {
          name: item.short_code,
          template: {
            source: 'chatwoot',
            short_code: item.short_code,
            content: item.content,
            chatwootCannedId: item.id,
          },
          source: 'chatwoot',
          readOnly: false,
          status: 'LOCAL',
          chatwootCannedId: `${item.id}`,
        },
      });

      importedChatwoot.push({
        templateId: saved.templateId,
        name: saved.name,
        source: 'chatwoot',
        readOnly: false,
        chatwootCannedId: saved.chatwootCannedId,
      });
    }

    this.logger.log(
      `Synced ${syncedMeta.length} Meta templates and ${importedChatwoot.length} Chatwoot user templates for ${instance.instanceName}`,
    );

    return {
      instanceName: instance.instanceName,
      metaSynced: syncedMeta.length,
      chatwootUserTemplates: importedChatwoot.length,
      metaPrefix: META_CANNED_PREFIX,
      meta: syncedMeta,
      chatwoot: importedChatwoot,
      note: 'Meta templates are read-only canned responses (meta_*). User canned responses remain editable and are not pushed to Meta.',
    };
  }
}
