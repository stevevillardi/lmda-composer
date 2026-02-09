import { useMemo, useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, Plug, ListX } from 'lucide-react';
import { useEditorStore } from '@/editor/stores/editor-store';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import type { ApiEndpointDefinition } from '@/editor/data/api-schema';
import { useApiSchema } from '@/editor/hooks/useApiSchema';
import { generateExampleFromSchema } from '@/editor/utils/api-example';
import { COLORS } from '@/editor/constants/colors';

interface EndpointGroup {
  tag: string;
  endpoints: ApiEndpointDefinition[];
}

export function ApiEndpointCatalog() {
  const { tabs, activeTabId, updateApiTabRequest, renameTab, setApiTabResponse } = useEditorStore();
  const { schema, isLoading, error, retry } = useApiSchema();
  const [query, setQuery] = useState('');
  const [collapsedTags, setCollapsedTags] = useState<Record<string, boolean>>({});
  const endpoints = schema?.endpoints ?? [];

  const groups = useMemo<EndpointGroup[]>(() => {
    const filtered = endpoints.filter((endpoint) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        endpoint.path.toLowerCase().includes(q) ||
        endpoint.method.toLowerCase().includes(q) ||
        (endpoint.summary ?? '').toLowerCase().includes(q) ||
        endpoint.tag.toLowerCase().includes(q)
      );
    });

    const grouped = new Map<string, ApiEndpointDefinition[]>();
    filtered.forEach((endpoint) => {
      const list = grouped.get(endpoint.tag) ?? [];
      list.push(endpoint);
      grouped.set(endpoint.tag, list);
    });

    return Array.from(grouped.entries()).map(([tag, endpoints]) => ({
      tag,
      endpoints,
    }));
  }, [endpoints, query]);

  const totalCount = endpoints.length;
  const filteredCount = useMemo(() => groups.reduce((sum, group) => sum + group.endpoints.length, 0), [groups]);

  useEffect(() => {
    const nextState: Record<string, boolean> = {};
    groups.forEach((group) => {
      if (collapsedTags[group.tag] === undefined) {
        nextState[group.tag] = false;
      }
    });
    if (Object.keys(nextState).length > 0) {
      setCollapsedTags((prev) => ({ ...prev, ...nextState }));
    }
  }, [groups, collapsedTags]);

  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);

  const handleSelectEndpoint = (endpoint: ApiEndpointDefinition) => {
    if (!activeTab || activeTab.kind !== 'api') return;

    const example = endpoint.requestBodySchema
      ? generateExampleFromSchema(endpoint.requestBodySchema)
      : null;
    const body = example ? JSON.stringify(example, null, 2) : '';

    updateApiTabRequest(activeTab.id, {
      method: endpoint.method,
      path: endpoint.path,
      queryParams: {},
      headerParams: {},
      body,
      bodyMode: example ? 'raw' : 'form',
    });
    renameTab(activeTab.id, `${endpoint.method} ${endpoint.path}`);
    setApiTabResponse(activeTab.id, null);
  };

  return (
    <div className="
      flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r
      border-border bg-background
    ">
      <div className="
        flex h-12 items-center gap-2 border-b border-border bg-background px-3
      ">
        <div className="relative min-w-0 flex-1">
          <Search className="
            absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2
            text-muted-foreground
          " />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search endpoints..."
            className="
              h-8 border-input bg-muted/30 pr-7 pl-8 text-xs shadow-sm
              transition-colors
              focus-visible:bg-background
            "
          />
          {query.trim() && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="
                absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground
                hover:text-foreground
              "
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <Badge variant="outline" className="
          flex h-6 items-center gap-1 bg-muted/30 px-1.5 text-[10px] font-normal
          select-none
        ">
          <Plug className="size-3 text-muted-foreground" />
          {isLoading ? '...' : `${filteredCount}/${totalCount}`}
        </Badge>
      </div>

      <ScrollArea className="min-h-0 flex-1 bg-muted/5">
        <div className="space-y-4 p-2">
          {groups.length === 0 ? (
            <div className="flex h-full flex-col">
              <Empty className="
                flex flex-1 flex-col justify-center border-0 bg-transparent
                py-12
              ">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="mb-4 bg-muted/50">
                    <ListX className="size-5 text-muted-foreground/70" />
                  </EmptyMedia>
                  <EmptyTitle className="text-base font-medium">
                    {error ? 'Failed to load schema' : 'No matching endpoints'}
                  </EmptyTitle>
                  <EmptyDescription className="mt-1.5 px-6">
                    {error
                      ? 'Please reopen the API Explorer to try again.'
                      : isLoading
                        ? 'Loading API schema...'
                        : 'Try a different search term or clear the filter.'}
                  </EmptyDescription>
                  {error && (
                    <div className="pt-4">
                      <Button size="sm" variant="outline" onClick={retry}>
                        Retry
                      </Button>
                    </div>
                  )}
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            groups.map((group) => {
              const isCollapsed = collapsedTags[group.tag] ?? false;
              return (
                <div key={group.tag} className="
                  overflow-hidden rounded-md border border-border/40 bg-card/20
                  shadow-sm
                ">
                  <button
                    className="
                      flex w-full items-center gap-2 border-b border-transparent
                      bg-muted/30 px-3 py-2 text-xs font-medium
                      text-muted-foreground transition-colors select-none
                      hover:bg-muted/50
                      data-[state=open]:border-border/40
                    "
                    data-state={!isCollapsed ? 'open' : 'closed'}
                    onClick={() =>
                      setCollapsedTags((prev) => ({
                        ...prev,
                        [group.tag]: !isCollapsed,
                      }))
                    }
                  >
                    {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="
                      size-3.5
                    " />}
                    <span className="
                      min-w-0 flex-1 truncate text-left text-foreground/80
                    ">{group.tag}</span>
                    <Badge variant="secondary" className="
                      h-4 border-border/50 bg-background/50 px-1.5 text-[10px]
                      font-normal text-muted-foreground
                    ">
                      {group.endpoints.length}
                    </Badge>
                  </button>

                  {!isCollapsed && (
                    <div className="divide-y divide-border/30 bg-background/30">
                      {group.endpoints.map((endpoint) => {
                        const methodStyle = COLORS.METHOD[endpoint.method];
                        const paramsByType = endpoint.parameters.reduce((acc, param) => {
                          acc[param.in] = acc[param.in] ?? [];
                          acc[param.in].push(param.name);
                          return acc;
                        }, {} as Record<'path' | 'query' | 'header', string[]>);

                        return (
                          <Tooltip key={endpoint.id}>
                            <TooltipTrigger
                              render={
                                <button
                                  className={cn(
                                    `
                                      group relative w-full border-l-2 px-3
                                      py-2.5 text-left transition-all
                                      hover:bg-muted/40
                                    `,
                                    `
                                      border-transparent
                                      hover:border-l-primary/50
                                    `
                                  )}
                                  onClick={() => handleSelectEndpoint(endpoint)}
                                >
                                  <div className="
                                    mb-1 flex items-center gap-2.5
                                  ">
                                    <span
                                      className={cn(
                                        `
                                          min-w-[36px] shrink-0 rounded-sm
                                          px-1.5 py-0.5 text-center text-[9px]
                                          font-bold tracking-tight uppercase
                                        `,
                                        methodStyle.bgSubtle,
                                        methodStyle.text
                                      )}
                                    >
                                      {endpoint.method}
                                    </span>
                                    <span className="
                                      flex-1 truncate font-mono text-xs
                                      text-foreground/90
                                    ">
                                      {endpoint.path}
                                    </span>
                                  </div>
                                  {endpoint.summary && (
                                    <div className="
                                      truncate pl-[46px] text-[11px]
                                      leading-tight text-muted-foreground
                                    ">
                                      {endpoint.summary}
                                    </div>
                                  )}
                                </button>
                              }
                            />
                            <TooltipContent side="right" className="
                              max-w-xs border border-border bg-popover p-3
                              text-popover-foreground
                            ">
                              <div className="space-y-2">
                                <div>
                                  <div className="mb-1 flex items-center gap-2">
                                    <Badge variant="outline" className={cn(`
                                      h-4 px-1 text-[9px]
                                    `, methodStyle.bgSubtle, methodStyle.text, `
                                      border-transparent
                                    `)}>
                                      {endpoint.method}
                                    </Badge>
                                    <span className="font-mono text-xs">{endpoint.path}</span>
                                  </div>
                                  {endpoint.summary && (
                                    <div className="
                                      text-xs text-muted-foreground
                                    ">{endpoint.summary}</div>
                                  )}
                                </div>
                                
                                {(paramsByType.path?.length || paramsByType.query?.length || paramsByType.header?.length) ? (
                                  <div className="
                                    space-y-1.5 border-t border-border/50 pt-2
                                    text-[10px]
                                  ">
                                    {paramsByType.path?.length ? (
                                      <div className="flex gap-1.5">
                                        <span className="
                                          w-10 shrink-0 text-muted-foreground
                                        ">Path:</span>
                                        <span className="
                                          font-mono text-foreground
                                        ">{paramsByType.path.join(', ')}</span>
                                      </div>
                                    ) : null}
                                    {paramsByType.query?.length ? (
                                      <div className="flex gap-1.5">
                                        <span className="
                                          w-10 shrink-0 text-muted-foreground
                                        ">Query:</span>
                                        <span className="
                                          font-mono text-foreground
                                        ">{paramsByType.query.join(', ')}</span>
                                      </div>
                                    ) : null}
                                    {paramsByType.header?.length ? (
                                      <div className="flex gap-1.5">
                                        <span className="
                                          w-10 shrink-0 text-muted-foreground
                                        ">Header:</span>
                                        <span className="
                                          font-mono text-foreground
                                        ">{paramsByType.header.join(', ')}</span>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
