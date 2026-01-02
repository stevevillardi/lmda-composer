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

interface OpenApiSchema {
  paths?: Record<
    string,
    Record<
      string,
      {
        tags?: string[];
        summary?: string;
        description?: string;
        parameters?: Array<{
          name: string;
          in: 'path' | 'query' | 'header';
          required?: boolean;
          description?: string;
          schema?: { type?: string; enum?: string[] };
        }>;
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

function buildEndpoints(schema: OpenApiSchema): ApiEndpointDefinition[] {
  const endpoints: ApiEndpointDefinition[] = [];
  const paths = schema.paths ?? {};

  Object.entries(paths).forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, meta]) => {
      const normalized = normalizeMethod(method);
      if (!normalized) return;
      const tag = meta.tags?.[0] ?? 'General';
      endpoints.push({
        id: `${normalized}:${path}`,
        method: normalized,
        path,
        tag,
        summary: meta.summary,
        description: meta.description,
        parameters: (meta.parameters ?? []).map((param) => ({
          name: param.name,
          in: param.in,
          required: Boolean(param.required),
          description: param.description,
          schema: param.schema,
        })),
        requestBodySchema: meta.requestBody?.content?.['application/json']?.schema,
        requestBodyRequired: Boolean(meta.requestBody?.required),
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
      const parsedSchema = (await response.json()) as OpenApiSchema;
      const apiSchema = { endpoints: buildEndpoints(parsedSchema) };
      cachedSchema = apiSchema;
      return apiSchema;
    })();
  }
  return pendingSchema;
}
