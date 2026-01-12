import { useMemo } from 'react';
import { BookOpen, ChevronRight, FileWarning } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { COLORS } from '@/editor/constants/colors';
import type { ApiEndpointDefinition, ApiParameterDefinition } from '@/editor/data/api-schema';
import { renderSchemaProperties, type SchemaProperty, type JSONSchemaLike } from '@/editor/utils/schema-renderer';
import { generateExampleFromSchema } from '@/editor/utils/api-example';

interface ApiEndpointDocsProps {
  endpoint: ApiEndpointDefinition | null;
}

function ParameterRow({ param }: { param: ApiParameterDefinition }) {
  return (
    <div className="
      group flex flex-col gap-1 border-b border-border/30 py-2.5 last:border-0
    ">
      <div className="flex items-center gap-2">
        <code className="font-mono text-xs text-foreground">{param.name}</code>
        <Badge variant="outline" className="
          h-4 border-border/50 bg-muted/30 px-1 text-[9px] font-normal
          text-muted-foreground
        ">
          {param.schema?.type ?? 'string'}
        </Badge>
        {param.required && (
          <Badge variant="outline" className="
            h-4 border-red-500/30 bg-red-500/10 px-1 text-[9px] font-normal
            text-red-400
          ">
            required
          </Badge>
        )}
      </div>
      {param.description && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {param.description}
        </p>
      )}
      {param.schema?.enum && param.schema.enum.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {param.schema.enum.map((value) => (
            <Badge
              key={value}
              variant="secondary"
              className="h-4 bg-muted/50 px-1.5 font-mono text-[9px]"
            >
              {value}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function SchemaPropertyRow({ property, depth = 0 }: { property: SchemaProperty; depth?: number }) {
  const hasChildren = property.children && property.children.length > 0;
  
  return (
    <div className="border-b border-border/20 last:border-0">
      <div
        className="flex flex-col gap-1 py-2"
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <div className="flex items-center gap-2">
          {hasChildren && (
            <ChevronRight className="size-3 text-muted-foreground" />
          )}
          <code className="font-mono text-xs text-foreground">{property.name}</code>
          <Badge variant="outline" className="
            h-4 border-border/50 bg-muted/30 px-1 text-[9px] font-normal
            text-muted-foreground
          ">
            {property.type}
          </Badge>
          {property.required && (
            <Badge variant="outline" className="
              h-4 border-red-500/30 bg-red-500/10 px-1 text-[9px] font-normal
              text-red-400
            ">
              required
            </Badge>
          )}
        </div>
        {property.description && (
          <p
            className="text-[11px] leading-relaxed text-muted-foreground"
            style={{ paddingLeft: hasChildren ? '20px' : '0' }}
          >
            {property.description}
          </p>
        )}
        {property.enumValues && property.enumValues.length > 0 && (
          <div
            className="mt-1 flex flex-wrap gap-1"
            style={{ paddingLeft: hasChildren ? '20px' : '0' }}
          >
            {property.enumValues.slice(0, 10).map((value) => (
              <Badge
                key={value}
                variant="secondary"
                className="h-4 bg-muted/50 px-1.5 font-mono text-[9px]"
              >
                {value}
              </Badge>
            ))}
            {property.enumValues.length > 10 && (
              <span className="text-[9px] text-muted-foreground">
                +{property.enumValues.length - 10} more
              </span>
            )}
          </div>
        )}
        {property.constraints && (
          <p
            className="text-[10px] text-muted-foreground/70"
            style={{ paddingLeft: hasChildren ? '20px' : '0' }}
          >
            {property.constraints}
          </p>
        )}
      </div>
      {hasChildren && (
        <div className="border-l border-border/30 ml-1.5">
          {property.children!.map((child) => (
            <SchemaPropertyRow key={child.name} property={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ApiEndpointDocs({ endpoint }: ApiEndpointDocsProps) {
  const pathParams = useMemo(
    () => endpoint?.parameters.filter((p) => p.in === 'path') ?? [],
    [endpoint]
  );

  const queryParams = useMemo(
    () => endpoint?.parameters.filter((p) => p.in === 'query') ?? [],
    [endpoint]
  );

  const headerParams = useMemo(
    () => endpoint?.parameters.filter((p) => p.in === 'header') ?? [],
    [endpoint]
  );

  const schemaProperties = useMemo(
    () => renderSchemaProperties(endpoint?.requestBodySchema as JSONSchemaLike | undefined),
    [endpoint]
  );

  const exampleBody = useMemo(() => {
    if (!endpoint?.requestBodySchema) return null;
    const example = generateExampleFromSchema(endpoint.requestBodySchema);
    return JSON.stringify(example, null, 2);
  }, [endpoint]);

  if (!endpoint) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        <Empty className="border-0 bg-transparent">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="mb-4 bg-muted/50">
              <BookOpen className="size-5 text-muted-foreground/70" />
            </EmptyMedia>
            <EmptyTitle className="text-base font-medium">No endpoint selected</EmptyTitle>
            <EmptyDescription className="mt-1.5">
              Select an endpoint from the catalog or enter a path in the request builder to view documentation.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const methodStyle = COLORS.METHOD[endpoint.method];
  const hasParameters = pathParams.length > 0 || queryParams.length > 0 || headerParams.length > 0;
  const hasRequestBody = schemaProperties.length > 0;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-3">
        {/* Header */}
        <div className="
          space-y-2 rounded-md border border-border/40 bg-card/40 p-3
          backdrop-blur-sm
        ">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                `
                  min-w-[40px] shrink-0 rounded-sm px-1.5 py-0.5 text-center
                  text-[10px] font-bold tracking-tight uppercase
                `,
                methodStyle.bgSubtle,
                methodStyle.text
              )}
            >
              {endpoint.method}
            </span>
            <code className="flex-1 truncate font-mono text-xs text-foreground/90">
              {endpoint.path}
            </code>
          </div>
          {endpoint.summary && (
            <p className="text-sm font-medium text-foreground">{endpoint.summary}</p>
          )}
          {endpoint.description && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {endpoint.description}
            </p>
          )}
        </div>

        {/* Parameters & Body */}
        {(hasParameters || hasRequestBody) ? (
          <Accordion defaultValue={['path', 'query', 'body']} className="space-y-2">
            {pathParams.length > 0 && (
              <AccordionItem
                value="path"
                className="
                  rounded-md border border-border/40 bg-card/40 backdrop-blur-sm
                "
              >
                <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Path Parameters</span>
                    <Badge variant="secondary" className="
                      h-4 bg-muted/50 px-1.5 text-[9px] font-normal
                    ">
                      {pathParams.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-2">
                  <div className="rounded-sm bg-muted/20 p-2">
                    {pathParams.map((param) => (
                      <ParameterRow key={param.name} param={param} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {queryParams.length > 0 && (
              <AccordionItem
                value="query"
                className="
                  rounded-md border border-border/40 bg-card/40 backdrop-blur-sm
                "
              >
                <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Query Parameters</span>
                    <Badge variant="secondary" className="
                      h-4 bg-muted/50 px-1.5 text-[9px] font-normal
                    ">
                      {queryParams.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-2">
                  <div className="rounded-sm bg-muted/20 p-2">
                    {queryParams.map((param) => (
                      <ParameterRow key={param.name} param={param} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {headerParams.length > 0 && (
              <AccordionItem
                value="header"
                className="
                  rounded-md border border-border/40 bg-card/40 backdrop-blur-sm
                "
              >
                <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Header Parameters</span>
                    <Badge variant="secondary" className="
                      h-4 bg-muted/50 px-1.5 text-[9px] font-normal
                    ">
                      {headerParams.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-2">
                  <div className="rounded-sm bg-muted/20 p-2">
                    {headerParams.map((param) => (
                      <ParameterRow key={param.name} param={param} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {hasRequestBody && (
              <AccordionItem
                value="body"
                className="
                  rounded-md border border-border/40 bg-card/40 backdrop-blur-sm
                "
              >
                <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Request Body</span>
                    {endpoint.requestBodyRequired && (
                      <Badge variant="outline" className="
                        h-4 border-red-500/30 bg-red-500/10 px-1 text-[9px]
                        font-normal text-red-400
                      ">
                        required
                      </Badge>
                    )}
                    <Badge variant="secondary" className="
                      h-4 bg-muted/50 px-1.5 text-[9px] font-normal
                    ">
                      {schemaProperties.length} fields
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-2">
                  <div className="space-y-3">
                    <div className="rounded-sm bg-muted/20 p-2">
                      {schemaProperties.map((prop) => (
                        <SchemaPropertyRow key={prop.name} property={prop} />
                      ))}
                    </div>
                    {exampleBody && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase">
                          Example
                        </p>
                        <pre className="
                          max-h-40 overflow-auto rounded-sm bg-muted/30 p-2
                          font-mono text-[10px] leading-relaxed text-foreground/80
                        ">
                          {exampleBody}
                        </pre>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        ) : (
          <div className="
            rounded-md border border-border/40 bg-card/40 p-4 text-center
            backdrop-blur-sm
          ">
            <div className="flex flex-col items-center gap-2">
              <FileWarning className="size-4 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                This endpoint has no parameters or request body.
              </p>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
