/**
 * Schema rendering utilities for displaying JSON Schema as readable property trees.
 * Used by the API Endpoint Docs component to visualize request/response schemas.
 */

export interface JSONSchemaLike {
  type?: string;
  description?: string;
  example?: unknown;
  enum?: unknown[];
  oneOf?: JSONSchemaLike[];
  anyOf?: JSONSchemaLike[];
  allOf?: JSONSchemaLike[];
  properties?: Record<string, JSONSchemaLike>;
  items?: JSONSchemaLike;
  required?: string[];
  format?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

export interface SchemaProperty {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  enumValues?: string[];
  format?: string;
  defaultValue?: string;
  constraints?: string;
  children?: SchemaProperty[];
  isArray?: boolean;
}

function getTypeString(schema: JSONSchemaLike): string {
  if (schema.enum && Array.isArray(schema.enum)) {
    return 'enum';
  }
  if (schema.oneOf) {
    return 'oneOf';
  }
  if (schema.anyOf) {
    return 'anyOf';
  }
  if (schema.allOf) {
    return 'object';
  }
  if (schema.type === 'array' || schema.items) {
    const itemType = schema.items ? getTypeString(schema.items) : 'unknown';
    return `${itemType}[]`;
  }
  return schema.type ?? 'unknown';
}

function getConstraints(schema: JSONSchemaLike): string | undefined {
  const parts: string[] = [];
  
  if (schema.minimum !== undefined) parts.push(`min: ${schema.minimum}`);
  if (schema.maximum !== undefined) parts.push(`max: ${schema.maximum}`);
  if (schema.minLength !== undefined) parts.push(`minLength: ${schema.minLength}`);
  if (schema.maxLength !== undefined) parts.push(`maxLength: ${schema.maxLength}`);
  
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function extractAllOfProperties(schemas: JSONSchemaLike[]): Record<string, JSONSchemaLike> {
  const merged: Record<string, JSONSchemaLike> = {};
  const requiredFields = new Set<string>();
  
  for (const schema of schemas) {
    if (schema.properties) {
      Object.assign(merged, schema.properties);
    }
    if (schema.required) {
      schema.required.forEach((r) => requiredFields.add(r));
    }
  }
  
  return merged;
}

function extractAllOfRequired(schemas: JSONSchemaLike[]): string[] {
  const requiredFields = new Set<string>();
  for (const schema of schemas) {
    if (schema.required) {
      schema.required.forEach((r) => requiredFields.add(r));
    }
  }
  return Array.from(requiredFields);
}

export function renderSchemaProperties(
  schema: JSONSchemaLike | null | undefined,
  depth = 0,
  requiredFields: string[] = []
): SchemaProperty[] {
  if (!schema || depth > 5) {
    return [];
  }

  // Handle allOf by merging properties
  if (schema.allOf && Array.isArray(schema.allOf)) {
    const mergedProps = extractAllOfProperties(schema.allOf);
    const mergedRequired = extractAllOfRequired(schema.allOf);
    return renderSchemaProperties(
      { type: 'object', properties: mergedProps, required: mergedRequired },
      depth,
      requiredFields
    );
  }

  // Handle oneOf/anyOf - show first variant
  if (schema.oneOf && Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return renderSchemaProperties(schema.oneOf[0], depth, requiredFields);
  }

  if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return renderSchemaProperties(schema.anyOf[0], depth, requiredFields);
  }

  // Handle object with properties
  if (schema.properties) {
    const required = schema.required ?? requiredFields;
    return Object.entries(schema.properties).map(([name, propSchema]) => {
      const prop: SchemaProperty = {
        name,
        type: getTypeString(propSchema),
        required: required.includes(name),
        description: propSchema.description,
        format: propSchema.format,
        constraints: getConstraints(propSchema),
      };

      if (propSchema.enum && Array.isArray(propSchema.enum)) {
        prop.enumValues = propSchema.enum.map((v) => String(v));
      }

      if (propSchema.default !== undefined) {
        prop.defaultValue = JSON.stringify(propSchema.default);
      }

      // Recurse into nested objects
      if (propSchema.properties || propSchema.allOf) {
        prop.children = renderSchemaProperties(propSchema, depth + 1, propSchema.required ?? []);
      }

      // Recurse into array items
      if (propSchema.items) {
        prop.isArray = true;
        if (propSchema.items.properties || propSchema.items.allOf) {
          prop.children = renderSchemaProperties(propSchema.items, depth + 1, propSchema.items.required ?? []);
        }
      }

      return prop;
    });
  }

  // Handle array at root level
  if (schema.items) {
    return renderSchemaProperties(schema.items, depth, schema.items.required ?? []);
  }

  return [];
}

/**
 * Get a flat summary of schema for simple display
 */
export function getSchemaTypeSummary(schema: JSONSchemaLike | null | undefined): string {
  if (!schema) return 'unknown';
  return getTypeString(schema);
}
