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
    <div className="h-full min-h-0 flex flex-col border-r border-border bg-background">
      <div className="h-12 px-3 border-b border-border flex items-center gap-2 bg-background">
        <div className="relative flex-1 min-w-0">
          <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search endpoints..."
            className="h-8 pl-8 pr-7 text-xs bg-muted/30 border-input shadow-sm focus-visible:bg-background transition-colors"
          />
          {query.trim() && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <Badge variant="outline" className="text-[10px] font-normal flex items-center gap-1 select-none h-6 px-1.5 bg-muted/30">
          <Plug className="size-3 text-muted-foreground" />
          {isLoading ? '...' : `${filteredCount}/${totalCount}`}
        </Badge>
      </div>

      <ScrollArea className="flex-1 min-h-0 bg-muted/5">
        <div className="p-2 space-y-4">
          {groups.length === 0 ? (
            <div className="flex flex-col h-full">
              <Empty className="border-0 bg-transparent flex-1 flex flex-col justify-center py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="bg-muted/50 mb-4">
                    <ListX className="size-5 text-muted-foreground/70" />
                  </EmptyMedia>
                  <EmptyTitle className="text-base font-medium">
                    {error ? 'Failed to load schema' : 'No matching endpoints'}
                  </EmptyTitle>
                  <EmptyDescription className="px-6 mt-1.5">
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
                <div key={group.tag} className="border border-border/40 rounded-md bg-card/20 overflow-hidden shadow-sm">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30 hover:bg-muted/50 transition-colors select-none border-b border-transparent data-[state=open]:border-border/40"
                    data-state={!isCollapsed ? 'open' : 'closed'}
                    onClick={() =>
                      setCollapsedTags((prev) => ({
                        ...prev,
                        [group.tag]: !isCollapsed,
                      }))
                    }
                  >
                    {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    <span className="flex-1 min-w-0 truncate text-left text-foreground/80">{group.tag}</span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal bg-background/50 border-border/50 text-muted-foreground">
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
                                    "w-full px-3 py-2.5 text-left transition-all border-l-2 relative group hover:bg-muted/40",
                                    "border-transparent hover:border-l-primary/50"
                                  )}
                                  onClick={() => handleSelectEndpoint(endpoint)}
                                >
                                  <div className="flex items-center gap-2.5 mb-1">
                                    <span
                                      className={cn(
                                        "text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-tight min-w-[36px] text-center",
                                        methodStyle.bgSubtle,
                                        methodStyle.text
                                      )}
                                    >
                                      {endpoint.method}
                                    </span>
                                    <span className="text-xs font-mono text-foreground/90 truncate flex-1">
                                      {endpoint.path}
                                    </span>
                                  </div>
                                  {endpoint.summary && (
                                    <div className="text-[11px] text-muted-foreground pl-[46px] truncate leading-tight">
                                      {endpoint.summary}
                                    </div>
                                  )}
                                </button>
                              }
                            />
                            <TooltipContent side="right" className="max-w-xs bg-popover text-popover-foreground border border-border p-3">
                              <div className="space-y-2">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className={cn("text-[9px] px-1 h-4", methodStyle.bgSubtle, methodStyle.text, "border-transparent")}>
                                      {endpoint.method}
                                    </Badge>
                                    <span className="font-mono text-xs">{endpoint.path}</span>
                                  </div>
                                  {endpoint.summary && (
                                    <div className="text-xs text-muted-foreground">{endpoint.summary}</div>
                                  )}
                                </div>
                                
                                {(paramsByType.path?.length || paramsByType.query?.length || paramsByType.header?.length) ? (
                                  <div className="text-[10px] space-y-1.5 pt-2 border-t border-border/50">
                                    {paramsByType.path?.length ? (
                                      <div className="flex gap-1.5">
                                        <span className="text-muted-foreground w-10 shrink-0">Path:</span>
                                        <span className="font-mono text-foreground">{paramsByType.path.join(', ')}</span>
                                      </div>
                                    ) : null}
                                    {paramsByType.query?.length ? (
                                      <div className="flex gap-1.5">
                                        <span className="text-muted-foreground w-10 shrink-0">Query:</span>
                                        <span className="font-mono text-foreground">{paramsByType.query.join(', ')}</span>
                                      </div>
                                    ) : null}
                                    {paramsByType.header?.length ? (
                                      <div className="flex gap-1.5">
                                        <span className="text-muted-foreground w-10 shrink-0">Header:</span>
                                        <span className="font-mono text-foreground">{paramsByType.header.join(', ')}</span>
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
