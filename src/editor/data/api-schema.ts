import type { ApiRequestMethod } from '@/shared/types';

export interface ApiEndpointDefinition {
  id: string;
  method: ApiRequestMethod;
  path: string;
  tag: string;
  summary?: string;
  description?: string;
  parameters: ApiParameterDefinition[];
  requestBodySchema?: unknown;
  requestBodyRequired?: boolean;
}

// Swagger 2.0 parameter (includes body params)
interface Swagger2Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'body' | 'formData';
  required?: boolean;
  description?: string;
  type?: string;
  format?: string;
  enum?: string[];
  schema?: unknown; // For body parameters in Swagger 2.0
}

interface Swagger2Schema {
  swagger?: string;
  definitions?: Record<string, unknown>;
  paths?: Record<
    string,
    Record<
      string,
      {
        tags?: string[];
        summary?: string;
        description?: string;
        parameters?: Swagger2Parameter[];
        // OpenAPI 3.0 style (not used by LM but kept for compatibility)
        requestBody?: {
          required?: boolean;
          content?: {
            'application/json'?: {
              schema?: unknown;
            };
          };
        };
      }
    >
  >;
}

export interface ApiParameterDefinition {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  description?: string;
  schema?: { type?: string; enum?: string[] };
}

function normalizeMethod(method: string): ApiRequestMethod | null {
  const upper = method.toUpperCase();
  if (upper === 'GET' || upper === 'POST' || upper === 'PUT' || upper === 'PATCH' || upper === 'DELETE') {
    return upper as ApiRequestMethod;
  }
  return null;
}

/**
 * Recursively resolve $ref references in a schema object
 */
function resolveRefs(schema: unknown, definitions: Record<string, unknown>, depth = 0): unknown {
  if (!schema || typeof schema !== 'object' || depth > 10) {
    return schema;
  }

  const obj = schema as Record<string, unknown>;

  // Handle $ref
  if ('$ref' in obj && typeof obj.$ref === 'string') {
    const refPath = obj.$ref;
    // Handle #/definitions/SomeName format
    if (refPath.startsWith('#/definitions/')) {
      const defName = refPath.slice('#/definitions/'.length);
      const resolved = definitions[defName];
      if (resolved) {
        return resolveRefs(resolved, definitions, depth + 1);
      }
    }
    return schema; // Return unresolved if we can't find it
  }

  // Handle allOf, oneOf, anyOf
  if ('allOf' in obj && Array.isArray(obj.allOf)) {
    return {
      ...obj,
      allOf: obj.allOf.map((item) => resolveRefs(item, definitions, depth + 1)),
    };
  }

  if ('oneOf' in obj && Array.isArray(obj.oneOf)) {
    return {
      ...obj,
      oneOf: obj.oneOf.map((item) => resolveRefs(item, definitions, depth + 1)),
    };
  }

  if ('anyOf' in obj && Array.isArray(obj.anyOf)) {
    return {
      ...obj,
      anyOf: obj.anyOf.map((item) => resolveRefs(item, definitions, depth + 1)),
    };
  }

  // Handle properties
  if ('properties' in obj && obj.properties && typeof obj.properties === 'object') {
    const resolvedProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj.properties as Record<string, unknown>)) {
      resolvedProps[key] = resolveRefs(value, definitions, depth + 1);
    }
    return { ...obj, properties: resolvedProps };
  }

  // Handle items (arrays)
  if ('items' in obj && obj.items) {
    return { ...obj, items: resolveRefs(obj.items, definitions, depth + 1) };
  }

  return schema;
}

function buildEndpoints(schema: Swagger2Schema): ApiEndpointDefinition[] {
  const endpoints: ApiEndpointDefinition[] = [];
  const paths = schema.paths ?? {};
  const definitions = schema.definitions ?? {};

  Object.entries(paths).forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, meta]) => {
      const normalized = normalizeMethod(method);
      if (!normalized) return;
      const tag = meta.tags?.[0] ?? 'General';

      // Separate body parameter from other parameters (Swagger 2.0)
      const allParams = meta.parameters ?? [];
      const bodyParam = allParams.find((p) => p.in === 'body');
      const nonBodyParams = allParams.filter((p) => p.in !== 'body' && p.in !== 'formData');

      // Extract request body schema
      let requestBodySchema: unknown = undefined;
      let requestBodyRequired = false;

      // Swagger 2.0: body is a parameter with in: "body"
      if (bodyParam?.schema) {
        requestBodySchema = resolveRefs(bodyParam.schema, definitions);
        requestBodyRequired = Boolean(bodyParam.required);
      }
      // OpenAPI 3.0 fallback (not used by LM but kept for compatibility)
      else if (meta.requestBody?.content?.['application/json']?.schema) {
        requestBodySchema = resolveRefs(meta.requestBody.content['application/json'].schema, definitions);
        requestBodyRequired = Boolean(meta.requestBody.required);
      }

      endpoints.push({
        id: `${normalized}:${path}`,
        method: normalized,
        path,
        tag,
        summary: meta.summary,
        description: meta.description,
        parameters: nonBodyParams.map((param) => ({
          name: param.name,
          in: param.in as 'path' | 'query' | 'header',
          required: Boolean(param.required),
          description: param.description,
          schema: param.type
            ? { type: param.type, enum: param.enum }
            : undefined,
        })),
        requestBodySchema,
        requestBodyRequired,
      });
    });
  });

  endpoints.sort((a, b) => {
    if (a.tag !== b.tag) return a.tag.localeCompare(b.tag);
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return a.method.localeCompare(b.method);
  });

  return endpoints;
}

export interface ApiSchema {
  endpoints: ApiEndpointDefinition[];
}

const API_SCHEMA_URL = 'https://www.logicmonitor.com/swagger-ui-master/api-v3/dist/swagger.json';

let cachedSchema: ApiSchema | null = null;
let pendingSchema: Promise<ApiSchema> | null = null;

export function resetApiSchemaCache(): void {
  cachedSchema = null;
  pendingSchema = null;
}

export async function loadApiSchema(): Promise<ApiSchema> {
  if (cachedSchema) return cachedSchema;
  if (!pendingSchema) {
    pendingSchema = (async () => {
      const response = await fetch(API_SCHEMA_URL, {
        headers: {
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to load API schema (${response.status})`);
      }
      const parsedSchema = (await response.json()) as Swagger2Schema;
      const apiSchema = { endpoints: buildEndpoints(parsedSchema) };
      cachedSchema = apiSchema;
      return apiSchema;
    })();
  }
  return pendingSchema;
}
