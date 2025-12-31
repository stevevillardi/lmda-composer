import { useMemo } from 'react';
import { Clock, Variable, Settings2, Route } from 'lucide-react';
import { useEditorStore } from '@/editor/stores/editor-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ApiKeyValueEditor } from './ApiKeyValueEditor';
import { Badge } from '@/components/ui/badge';
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
      <div className="h-12 px-3 border-b border-border flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
            <ApiKeyValueEditor
              label="Environment Variables"
              values={Object.fromEntries(envVariables.map((entry) => [entry.key, entry.value]))}
              onChange={(values) => {
                if (!selectedPortalId) return;
                const variables = Object.entries(values).map(([key, value]) => ({ key, value }));
                setApiEnvironment(selectedPortalId, variables);
              }}
              emptyLabel={selectedPortalId ? 'Add variables like {{deviceId}}' : 'Select a portal first'}
            />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="history" className="flex-1 min-h-0 px-3 pb-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-muted-foreground">
              Last {preferences.apiHistoryLimit} responses
            </span>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => clearApiHistory(selectedPortalId ?? undefined)}
              disabled={!selectedPortalId || history.length === 0}
            >
              Clear
            </Button>
          </div>
          <ScrollArea className="h-full pr-2">
            {history.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                No API requests yet.
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="border border-border rounded-md p-2 bg-card/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {entry.request.method}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {entry.response.status}
                      </span>
                    </div>
                    <div className="text-xs text-foreground truncate">{entry.request.path}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">
                        {entry.response.durationMs}ms
                      </span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          const newTabId = openApiExplorerTab();
                          updateApiTabRequest(newTabId, entry.request);
                          setApiTabResponse(newTabId, entry.response);
                        }}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="helpers" className="flex-1 min-h-0 px-3 pb-3">
          <ScrollArea className="h-full pr-2">
            <div className="space-y-4">
              <div className="space-y-2 border border-border rounded-md p-3 bg-card/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Route className="size-4 text-muted-foreground" />
                    <div className="text-xs font-medium text-foreground">JSON Path Helpers</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-normal">Top-level</Badge>
                </div>
                {responseJson && typeof responseJson === 'object' && !hasItemsArray ? (
                  <div className="space-y-2">
                    {helperEntries.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No scalar fields available to save.
                      </p>
                    ) : (
                      helperEntries.map(([key, value]) => {
                        const path = `$.${key}`;
                        return (
                          <div key={key} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-foreground">{path}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(path);
                                  toast.success('Path copied');
                                }}
                              >
                                Copy
                              </Button>
                              <Button
                                variant="ghost"
                                size="xs"
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
                      <p className="text-[11px] text-muted-foreground">
                        Showing first 50 fields. Use the response viewer for deeper inspection.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {hasItemsArray
                      ? 'Helpers are available for single-resource responses.'
                      : 'Run a request to enable JSON path helpers.'}
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
