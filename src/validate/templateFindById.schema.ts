import { JSONSchema7 } from 'json-schema';
import { v4 } from 'uuid';

const isNotEmpty = (...propertyNames: string[]): JSONSchema7 => {
  const properties: Record<string, unknown> = {};
  propertyNames.forEach(
    (property) =>
      (properties[property] = {
        minLength: 1,
        description: `The "${property}" cannot be empty`,
      }),
  );
  return {
    if: {
      propertyNames: {
        enum: [...propertyNames],
      },
    },
    then: { properties },
  } as JSONSchema7;
};

export const templateFindByIdSchema: JSONSchema7 = {
  $id: v4(),
  type: 'object',
  properties: {
    templateId: { type: 'string' },
    fields: { type: 'string' },
  },
  required: ['templateId'],
  ...isNotEmpty('templateId'),
};
