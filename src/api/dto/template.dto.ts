export class TemplateDto {
  name: string;
  category: string;
  allowCategoryChange: boolean;
  language: string;
  components: any;
  webhookUrl?: string;
  parameterFormat?: 'POSITIONAL' | 'NAMED';
  libraryTemplateName?: string;
  libraryTemplateButtonInputs?: any;
}

export class TemplateEditDto {
  templateId: string;
  category?: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  allowCategoryChange?: boolean;
  ttl?: number;
  components?: any;
}

export class TemplateDeleteDto {
  name: string;
  hsmId?: string;
}

export class TemplateFindByIdDto {
  templateId: string;
  fields?: string;
}

export class TemplateFindDto {
  status?: string;
  limit?: number | string;
  after?: string;
  before?: string;
  name?: string;
  language?: string;
  category?: string;
  fields?: string;
}
