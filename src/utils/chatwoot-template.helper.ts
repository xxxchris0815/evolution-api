export const META_CANNED_PREFIX = 'meta_';
export const META_READONLY_MARKER = '[META:readonly]';
export const META_JSON_MARKER = '---evo-json---';

export type MetaTemplatePayload = {
  source: 'meta';
  readOnly: true;
  name: string;
  language: string;
  category?: string;
  status?: string;
  metaTemplateId: string;
  components?: any[];
};

export type ParsedChatwootTemplateSend = {
  name: string;
  language: string;
  components?: any[];
  metaTemplateId?: string;
};

export function buildMetaCannedShortCode(templateId: string, name: string, language: string): string {
  const safeName = (name || 'template').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
  const safeLang = (language || 'en').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 12);
  const idTail = `${templateId || ''}`.slice(-8);
  return `${META_CANNED_PREFIX}${safeName}_${safeLang}_${idTail}`.slice(0, 100);
}

export function isMetaManagedCannedShortCode(shortCode?: string | null): boolean {
  return !!shortCode && shortCode.startsWith(META_CANNED_PREFIX);
}

function previewFromComponents(components: any[] = []): string {
  const lines: string[] = [];
  for (const component of components) {
    if (!component?.type) continue;
    const type = `${component.type}`.toUpperCase();
    if (component.text) {
      lines.push(`${type}: ${component.text}`);
    } else if (component.format) {
      lines.push(`${type}: (${component.format})`);
    } else {
      lines.push(`${type}`);
    }
  }
  return lines.join('\n') || '(no preview)';
}

export function buildMetaCannedContent(payload: MetaTemplatePayload): string {
  const preview = previewFromComponents(payload.components || []);
  return [
    `🔒 ${META_READONLY_MARKER} WhatsApp template (managed by Evolution — do not edit)`,
    `name: ${payload.name}`,
    `language: ${payload.language}`,
    `category: ${payload.category || ''}`,
    `status: ${payload.status || ''}`,
    `id: ${payload.metaTemplateId}`,
    '',
    '---preview---',
    preview,
    '',
    'Optional body params (pipe-separated) when sending this canned response:',
    'params:',
    '',
    META_JSON_MARKER,
    JSON.stringify(payload),
  ].join('\n');
}

export function extractParamsLine(content: string): string[] {
  const match = content.match(/(?:^|\n)params:\s*(.+?)(?:\n|$)/i);
  if (!match?.[1]) return [];
  const raw = match[1].trim();
  if (!raw) return [];
  return raw
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildBodyComponentsFromParams(params: string[]): any[] | undefined {
  if (!params.length) return undefined;
  return [
    {
      type: 'body',
      parameters: params.map((text) => ({ type: 'text', text })),
    },
  ];
}

export function buildComponentsFromProcessedParams(
  processedParams: Record<string, any> | undefined,
): any[] | undefined {
  if (!processedParams || typeof processedParams !== 'object') return undefined;

  const components: any[] = [];

  const mapParams = (values: Record<string, any> | string[] | undefined, type: string) => {
    if (!values) return;
    const entries = Array.isArray(values)
      ? values.map((text, index) => [String(index + 1), text])
      : Object.entries(values).sort((a, b) => Number(a[0]) - Number(b[0]));

    if (!entries.length) return;

    components.push({
      type,
      parameters: entries.map(([, value]) => {
        if (value && typeof value === 'object') {
          return value;
        }
        return { type: 'text', text: `${value}` };
      }),
    });
  };

  mapParams(processedParams.header, 'header');
  mapParams(processedParams.body, 'body');
  mapParams(processedParams.buttons, 'button');

  return components.length ? components : undefined;
}

export function parseMetaCannedContent(content: string): ParsedChatwootTemplateSend | null {
  if (!content || !content.includes(META_READONLY_MARKER)) {
    return null;
  }

  let payload: MetaTemplatePayload | null = null;
  const jsonIdx = content.indexOf(META_JSON_MARKER);
  if (jsonIdx >= 0) {
    const raw = content.slice(jsonIdx + META_JSON_MARKER.length).trim();
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (!payload?.name) {
    return null;
  }

  const lineParams = extractParamsLine(content);
  const components = buildBodyComponentsFromParams(lineParams) || undefined;

  return {
    name: payload.name,
    language: payload.language || 'en_US',
    metaTemplateId: payload.metaTemplateId,
    components,
  };
}

export function parseChatwootTemplateMessage(body: any): ParsedChatwootTemplateSend | null {
  const templateParams =
    body?.content_attributes?.template_params ||
    body?.template_params ||
    body?.conversation?.messages?.[0]?.content_attributes?.template_params;

  if (templateParams?.name) {
    return {
      name: templateParams.name,
      language: templateParams.language || templateParams.language_code || 'en_US',
      components: buildComponentsFromProcessedParams(templateParams.processed_params),
    };
  }

  const content = `${body?.content || body?.conversation?.messages?.[0]?.content || ''}`;
  return parseMetaCannedContent(content);
}
