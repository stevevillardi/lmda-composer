import { useMemo, useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, Plug, ListX } from 'lucide-react';
import { useEditorStore } from '@/editor/stores/editor-store';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { API_SCHEMA, type ApiEndpointDefinition } from '@/editor/data/api-schema';
import { generateExampleFromSchema } from '@/editor/utils/api-example';
import { COLORS } from '@/editor/constants/colors';

interface EndpointGroup {
  tag: string;
  endpoints: ApiEndpointDefinition[];
}

export function ApiEndpointCatalog() {
  const { tabs, activeTabId, updateApiTabRequest, renameTab, setApiTabResponse } = useEditorStore();
  const [query, setQuery] = useState('');
  const [collapsedTags, setCollapsedTags] = useState<Record<string, boolean>>({});

  const groups = useMemo<EndpointGroup[]>(() => {
    const filtered = API_SCHEMA.endpoints.filter((endpoint) => {
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
  }, [query]);

  const totalCount = API_SCHEMA.endpoints.length;
  const filteredCount = useMemo(() => groups.reduce((sum, group) => sum + group.endpoints.length, 0), [groups]);

  useEffect(() => {
    const nextState: Record<string, boolean> = {};
    groups.forEach((group) => {
      if (collapsedTags[group.tag] === undefined) {
        nextState[group.tag] = true;
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
      <div className="h-12 px-3 border-b border-border flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="size-4 text-muted-foreground absolute left-2 top-2.5" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search endpoints..."
            className="h-8 pl-8 pr-7 text-xs"
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
        <Badge variant="outline" className="text-[10px] font-normal flex items-center gap-1 select-none">
          <Plug className="size-3" />
          {filteredCount}/{totalCount}
        </Badge>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 pb-6 space-y-4">
          {groups.length === 0 ? (
            <Empty className="border border-dashed border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ListX className="size-5" />
                </EmptyMedia>
                <EmptyTitle>No matching endpoints</EmptyTitle>
                <EmptyDescription>Try a different search term or clear the filter.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            groups.map((group) => {
              const isCollapsed = collapsedTags[group.tag] ?? true;
              return (
                <div key={group.tag} className="space-y-2">
                  <button
                    className="w-full flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide text-left cursor-pointer transition-colors hover:text-foreground select-none"
                    onClick={() =>
                      setCollapsedTags((prev) => ({
                        ...prev,
                        [group.tag]: !isCollapsed,
                      }))
                    }
                  >
                    {isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
                    <Tooltip>
                      <TooltipTrigger
                        render={<span className="flex-1 min-w-0 truncate text-left">{group.tag}</span>}
                      />
                      <TooltipContent>{group.tag}</TooltipContent>
                    </Tooltip>
                    <Badge variant="secondary" className="text-[10px] font-normal ml-auto flex items-center gap-1 select-none">
                      <Plug className="size-3" />
                      {group.endpoints.length}
                    </Badge>
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-1">
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
                                    "w-full rounded-md border border-transparent px-2.5 py-2 text-left transition-colors",
                                    "hover:bg-accent hover:border-border/70 cursor-pointer"
                                  )}
                                  onClick={() => handleSelectEndpoint(endpoint)}
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                                        methodStyle.bgSubtle,
                                        methodStyle.text
                                      )}
                                    >
                                      {endpoint.method}
                                    </span>
                                    <span className="text-xs text-foreground truncate">{endpoint.path}</span>
                                  </div>
                                  {endpoint.summary && (
                                    <div className="text-[11px] text-muted-foreground mt-1 truncate">
                                      {endpoint.summary}
                                    </div>
                                  )}
                                </button>
                              }
                            />
                            <TooltipContent className="max-w-xs bg-popover text-popover-foreground border border-border">
                              <div className="space-y-1">
                                <div className="text-xs font-medium">
                                  {endpoint.method} {endpoint.path}
                                </div>
                                {endpoint.summary && (
                                  <div className="text-[11px] text-muted-foreground">{endpoint.summary}</div>
                                )}
                                <div className="text-[11px] text-muted-foreground space-y-1">
                                  {paramsByType.path?.length ? (
                                    <div>Path: {paramsByType.path.join(', ')}</div>
                                  ) : null}
                                  {paramsByType.query?.length ? (
                                    <div>Query: {paramsByType.query.join(', ')}</div>
                                  ) : null}
                                  {paramsByType.header?.length ? (
                                    <div>Headers: {paramsByType.header.join(', ')}</div>
                                  ) : null}
                                </div>
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
