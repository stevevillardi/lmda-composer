import { useMemo } from 'react';
import { Clock, Variable, Settings2, Route, FileWarning, History as HistoryIcon, Copy } from 'lucide-react';
import { useEditorStore } from '@/editor/stores/editor-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ApiKeyValueEditor } from './ApiKeyValueEditor';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { COLORS } from '@/editor/constants/colors';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

export function ApiRightSidebar() {
  const {
    selectedPortalId,
    apiEnvironmentsByPortal,
    apiHistoryByPortal,
    setApiEnvironment,
    clearApiHistory,
    openApiExplorerTab,
    updateApiTabRequest,
    setApiTabResponse,
    tabs,
    activeTabId,
    preferences,
  } = useEditorStore();

  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);

  const envVariables = selectedPortalId
    ? apiEnvironmentsByPortal[selectedPortalId]?.variables ?? []
    : [];

  const history = selectedPortalId
    ? apiHistoryByPortal[selectedPortalId] ?? []
    : [];

  const responseBody = activeTab?.api?.response?.body ?? '';
  const responsePreview = activeTab?.api?.response?.jsonPreview;

  const responseJson = useMemo(() => {
    if (responsePreview) return responsePreview;
    if (!responseBody) return null;
    try {
      return JSON.parse(responseBody) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [responseBody, responsePreview]);

  const helperEntries = useMemo(() => {
    if (!responseJson || typeof responseJson !== 'object') return [];
    if (Array.isArray(responseJson)) return [];
    const entries = Object.entries(responseJson).filter(([, value]) =>
      value === null || ['string', 'number', 'boolean'].includes(typeof value)
    );
    return entries.slice(0, 50);
  }, [responseJson]);

  const hasItemsArray = useMemo(() => {
    if (!responseJson || typeof responseJson !== 'object') return false;
    if (Array.isArray(responseJson)) return true;
    const record = responseJson as Record<string, unknown>;
    return Array.isArray(record.items) || Array.isArray(record.data);
  }, [responseJson]);

  return (
    <div className="h-full flex flex-col border-l border-border bg-background">
      <div className="h-12 px-3 border-b border-border flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide select-none">
        <Settings2 className="size-3.5" />
        <span>API Tools</span>
      </div>
      <Tabs defaultValue="variables" className="flex-1 min-h-0">
        <TabsList className="px-3 pt-3" variant="line">
          <TabsTrigger value="variables">
            <Variable className="size-3.5 mr-1" />
            Variables
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="size-3.5 mr-1" />
            History
          </TabsTrigger>
          <TabsTrigger value="helpers">
            <Settings2 className="size-3.5 mr-1" />
            Helpers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="variables" className="flex-1 min-h-0 px-3 pb-3">
          <ScrollArea className="h-full pr-2">
            <div className="space-y-4">
              <ApiKeyValueEditor
                className="bg-card/40 rounded-md border border-border/40 p-3 shadow-sm backdrop-blur-sm"
                label={
                  <>
                    <Variable className="size-3.5" />
                    Environment Variables
                  </>
                }
                values={Object.fromEntries(envVariables.map((entry) => [entry.key, entry.value]))}
                onChange={(values) => {
                  if (!selectedPortalId) return;
                  const variables = Object.entries(values).map(([key, value]) => ({ key, value }));
                  setApiEnvironment(selectedPortalId, variables);
                }}
                emptyLabel={selectedPortalId ? 'Add variables like {{deviceId}}' : 'Select a portal first'}
              />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="history" className="flex-1 min-h-0 px-3 pb-3">
          <div className="flex items-center justify-between py-2 border-b border-border mb-2">
            <span className="text-xs text-muted-foreground select-none">
              Last {preferences.apiHistoryLimit} responses
            </span>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => clearApiHistory(selectedPortalId ?? undefined)}
              disabled={!selectedPortalId || history.length === 0}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              Clear
            </Button>
          </div>
          <ScrollArea className="h-full pr-2">
            {history.length === 0 ? (
              <Empty className="border-0 bg-transparent py-8 flex flex-col items-center justify-center">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="bg-muted/50 mb-4">
                    <HistoryIcon className="size-5 text-muted-foreground/70" />
                  </EmptyMedia>
                  <EmptyTitle className="text-base font-medium">No requests yet</EmptyTitle>
                  <EmptyDescription>Run a request to populate your history.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => {
                  const methodStyle = COLORS.METHOD[entry.request.method];
                  const isSuccess = entry.response.status >= 200 && entry.response.status < 300;
                  return (
                    <div
                      key={entry.id}
                      className="group relative p-2 rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm hover:bg-card hover:border-border transition-colors select-none"
                    >
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg",
                        isSuccess ? "bg-teal-500" : "bg-red-500"
                      )} />
                      
                      <div className="pl-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tight",
                                methodStyle.bgSubtle,
                                methodStyle.text
                              )}
                            >
                              {entry.request.method}
                            </span>
                            <Badge variant="outline" className={cn("text-[9px] h-4 px-1 border-transparent", isSuccess ? "bg-teal-500/10 text-teal-600" : "bg-red-500/10 text-red-600")}>
                              {entry.response.status}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {entry.response.durationMs}ms
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between gap-2">
                          <Tooltip>
                            <TooltipTrigger
                              render={<div className="text-xs text-foreground/90 truncate flex-1 font-mono">{entry.request.path}</div>}
                            />
                            <TooltipContent>{entry.request.path}</TooltipContent>
                          </Tooltip>
                          
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    className="size-6 hover:bg-primary/10 hover:text-primary"
                                    onClick={() => {
                                      const newTabId = openApiExplorerTab();
                                      updateApiTabRequest(newTabId, entry.request);
                                      setApiTabResponse(newTabId, entry.response);
                                    }}
                                  >
                                    {/* Use a play-like icon or just 'Open' text if prefered, sticking to text as per previous implementation but improved */}
                                    <Route className="size-3.5" />
                                  </Button>
                                }
                              />
                              <TooltipContent>Open in new tab</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="helpers" className="flex-1 min-h-0 px-3 pb-3">
          <ScrollArea className="h-full pr-2">
            <div className="space-y-4">
              <div className="space-y-2 border border-border/40 rounded-md p-3 bg-card/40 backdrop-blur-sm">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <Route className="size-4 text-muted-foreground" />
                    <div className="text-xs font-medium text-foreground">JSON Path Helpers</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-normal select-none bg-background/50">Top-level</Badge>
                </div>
                {responseJson && typeof responseJson === 'object' && !hasItemsArray ? (
                  <div className="space-y-1">
                    {helperEntries.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center">
                        No scalar fields available to save.
                      </p>
                    ) : (
                      helperEntries.map(([key, value]) => {
                        const path = `$.${key}`;
                        return (
                          <div key={key} className="flex items-center justify-between gap-2 text-xs group hover:bg-muted/40 p-1.5 rounded-sm transition-colors relative pl-2.5">
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary opacity-0 group-hover:opacity-100 transition-opacity rounded-full my-1" />
                            <span className="truncate text-foreground font-mono">{path}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      className="size-6"
                                      onClick={async () => {
                                        await navigator.clipboard.writeText(path);
                                        toast.success('Path copied');
                                      }}
                                    >
                                      <Copy className="size-3" />
                                    </Button>
                                  }
                                />
                                <TooltipContent>Copy Path</TooltipContent>
                              </Tooltip>
                              
                              <Button
                                variant="ghost"
                                size="xs"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => {
                                  if (!selectedPortalId) return;
                                  const nextVars = [...envVariables.filter(v => v.key !== key), { key, value: String(value) }];
                                  setApiEnvironment(selectedPortalId, nextVars);
                                  toast.success(`Saved ${key} as variable`);
                                }}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {helperEntries.length >= 50 && (
                      <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                        Showing first 50 fields. Use the response viewer for deeper inspection.
                      </p>
                    )}
                  </div>
                ) : (
                  <Empty className="border-0 bg-transparent py-4">
                    <EmptyHeader>
                      <EmptyMedia variant="icon" className="bg-muted/50 mb-2">
                        <FileWarning className="size-4 text-muted-foreground/70" />
                      </EmptyMedia>
                      <EmptyTitle className="text-sm font-medium">No helpers available</EmptyTitle>
                      <EmptyDescription className="text-xs">
                        {hasItemsArray
                          ? 'Helpers show for single-resource responses.'
                          : 'Run a request to enable JSON path helpers.'}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
