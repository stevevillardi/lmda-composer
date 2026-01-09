/**
 * Minimal JSON Schema-like interface for OpenAPI schema objects.
 * Covers the fields actually used for example generation.
 */
interface JSONSchemaLike {
  type?: string;
  example?: unknown;
  enum?: unknown[];
  oneOf?: JSONSchemaLike[];
  anyOf?: JSONSchemaLike[];
  allOf?: JSONSchemaLike[];
  properties?: Record<string, JSONSchemaLike>;
  items?: JSONSchemaLike;
}

export function generateExampleFromSchema(schema: JSONSchemaLike | null | undefined, depth = 0): unknown {
  if (!schema || depth > 4) {
    return {};
  }

  if (schema.example !== undefined) {
    return schema.example;
  }

  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  if (schema.oneOf && Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return generateExampleFromSchema(schema.oneOf[0], depth + 1);
  }

  if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return generateExampleFromSchema(schema.anyOf[0], depth + 1);
  }

  if (schema.allOf && Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const merged: Record<string, unknown> = {};
    schema.allOf.forEach((item: JSONSchemaLike) => {
      const value = generateExampleFromSchema(item, depth + 1);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(merged, value);
      }
    });
    return merged;
  }

  if (schema.type === 'object' || schema.properties) {
    const result: Record<string, unknown> = {};
    const properties = schema.properties ?? {};
    const entries = Object.entries(properties).slice(0, 6);
    for (const [key, value] of entries) {
      result[key] = generateExampleFromSchema(value, depth + 1);
    }
    return result;
  }

  if (schema.type === 'array' || schema.items) {
    return [generateExampleFromSchema(schema.items ?? {}, depth + 1)];
  }

  switch (schema.type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    default:
      return {};
  }
}
