import { useMemo, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '@/editor/stores/editor-store';
import { ApiKeyValueEditor } from './ApiKeyValueEditor';
import { ApiPathAutocomplete } from './ApiPathAutocomplete';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import type { ApiRequestMethod } from '@/shared/types';
import type { ApiEndpointDefinition } from '@/editor/data/api-schema';
import { useApiSchema } from '@/editor/hooks/useApiSchema';
import { generateExampleFromSchema } from '@/editor/utils/api-example';
import { Braces, KeyRound, SlidersHorizontal } from 'lucide-react';
import { buildMonacoOptions, getMonacoTheme } from '@/editor/utils/monaco-settings';
import '../../monaco-loader';

const METHOD_OPTIONS: ApiRequestMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export function ApiRequestBuilder() {
  const {
    tabs,
    activeTabId,
    updateApiTabRequest,
    renameTab,
    preferences,
    setApiTabResponse,
  } = useEditorStore();

  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);

  const request = activeTab?.api?.request;
  const method = request?.method ?? 'GET';
  const path = request?.path ?? '';
  const body = request?.body ?? '';
  const bodyMode = request?.bodyMode ?? 'form';
  const queryParams = request?.queryParams ?? {};
  const headerParams = request?.headerParams ?? {};

  const monacoTheme = useMemo(() => getMonacoTheme(preferences), [preferences]);
  const { schema } = useApiSchema();

  const editorOptions = useMemo(() => buildMonacoOptions(preferences, {
    minimap: { enabled: false },
    wordWrap: 'on' as const,
    tabSize: preferences.tabSize,
    insertSpaces: true,
    padding: { top: 10, bottom: 10 },
  }), [preferences]);

  const endpoint = useMemo(() => {
    return schema?.endpoints.find((entry) => entry.method === method && entry.path === path);
  }, [method, path, schema]);

  const queryParamSuggestions = useMemo(
    () =>
      endpoint?.parameters
        .filter((param) => param.in === 'query')
        .map((param) => ({
          key: param.name,
          description: param.description,
          required: param.required,
        })) ?? [],
    [endpoint]
  );

  const headerParamSuggestions = useMemo(
    () =>
      endpoint?.parameters
        .filter((param) => param.in === 'header')
        .map((param) => ({
          key: param.name,
          description: param.description,
          required: param.required,
        })) ?? [],
    [endpoint]
  );

  const handleBodyChange = (value: string | undefined) => {
    if (!activeTabId) return;
    updateApiTabRequest(activeTabId, {
      body: value ?? '',
      bodyMode: 'raw',
    });
  };

  const updateTabName = useCallback((nextMethod: ApiRequestMethod, nextPath: string) => {
    if (!activeTabId || !activeTab) return;
    if (!activeTab.displayName.startsWith('API Request')) return;
    const trimmedPath = nextPath.trim();
    const label = trimmedPath ? `${nextMethod} ${trimmedPath}` : 'API Request';
    renameTab(activeTabId, label);
  }, [activeTabId, activeTab, renameTab]);

  const handleSelectEndpoint = useCallback((endpoint: ApiEndpointDefinition) => {
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
  }, [activeTab, updateApiTabRequest, renameTab, setApiTabResponse]);

  const parsedBody = useMemo(() => {
    if (!body.trim()) return {};
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
            key,
            typeof value === 'string' ? value : JSON.stringify(value),
          ])
        );
      }
    } catch {
      return {};
    }
    return {};
  }, [body]);

  const handleFormBodyChange = (values: Record<string, string>) => {
    if (!activeTabId) return;
    updateApiTabRequest(activeTabId, {
      body: JSON.stringify(values, null, 2),
      bodyMode: 'form',
    });
  };

  if (!activeTab || activeTab.kind !== 'api') {
    return (
      <div className="
        flex h-full items-center justify-center text-sm text-muted-foreground
      ">
        Select an API tab to begin.
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="flex h-12 items-center gap-2 border-b border-border px-3">
        <Select
          value={method}
          onValueChange={(value) => {
            const nextMethod = value as ApiRequestMethod;
            updateApiTabRequest(activeTab.id, { method: nextMethod });
            updateTabName(nextMethod, path);
          }}
          items={METHOD_OPTIONS.map((value) => ({ value, label: value }))}
        >
          <SelectTrigger size="sm" className="w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METHOD_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ApiPathAutocomplete
          value={path}
          method={method}
          endpoints={schema?.endpoints ?? []}
          onChange={(nextPath) => {
            updateApiTabRequest(activeTab.id, { path: nextPath });
            updateTabName(method, nextPath);
          }}
          onSelectEndpoint={handleSelectEndpoint}
          className="flex-1"
        />

      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] bg-muted/5">
        <Tabs
          value={bodyMode}
          onValueChange={(value) => updateApiTabRequest(activeTab.id, { bodyMode: value as 'form' | 'raw' })}
          className="flex h-full min-h-0 flex-col"
        >
          <div className="
            shrink-0 border-b border-border bg-background px-3 pt-2
          ">
            <TabsList className="mb-2 h-8 w-full bg-muted/50 p-0.5" variant="default">
              <TabsTrigger value="form" className="
                h-7 flex-1 text-xs
                data-[state=active]:bg-background data-[state=active]:shadow-sm
              ">Form</TabsTrigger>
              <TabsTrigger value="raw" className="
                h-7 flex-1 text-xs
                data-[state=active]:bg-background data-[state=active]:shadow-sm
              ">Raw JSON</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="form" className="flex min-h-0 flex-1 flex-col p-3">
            <div className="
              flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-2
            ">
              <div className="grid grid-cols-2 gap-3">
                <ApiKeyValueEditor
                  className="
                    rounded-md border border-border/40 bg-card/40 p-3 shadow-sm
                  "
                  label={
                    <>
                      <SlidersHorizontal className="size-3.5" />
                      Query Parameters
                    </>
                  }
                  values={queryParams}
                  onChange={(values) => updateApiTabRequest(activeTab.id, { queryParams: values })}
                  emptyLabel="No query params"
                  suggestions={queryParamSuggestions}
                />
                <ApiKeyValueEditor
                  className="
                    rounded-md border border-border/40 bg-card/40 p-3 shadow-sm
                  "
                  label={
                    <>
                      <KeyRound className="size-3.5" />
                      Headers
                    </>
                  }
                  values={headerParams}
                  onChange={(values) => updateApiTabRequest(activeTab.id, { headerParams: values })}
                  emptyLabel="No headers"
                  suggestions={headerParamSuggestions}
                />
              </div>

              <div className="
                rounded-md border border-border/60 bg-card/40 shadow-sm
                backdrop-blur-sm
              ">
                <div className="
                  flex items-center justify-between border-b border-border/60
                  bg-muted/20 px-3 py-2
                ">
                  <span className="
                    text-xs font-medium text-muted-foreground select-none
                  ">JSON Body (form)</span>
                  <Badge variant="outline" className="
                    h-5 px-1.5 text-[10px] font-normal select-none
                  ">application/json</Badge>
                </div>
                <div className="p-3">
                  <ApiKeyValueEditor
                    label={
                      <>
                        <Braces className="size-3.5" />
                        Body Fields
                      </>
                    }
                    values={parsedBody as Record<string, string>}
                    onChange={handleFormBodyChange}
                    emptyLabel="Add fields to build a JSON body."
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="raw" className="flex min-h-0 flex-1 flex-col p-3">
            <div className="
              flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-2
            ">
              <div className="grid grid-cols-2 gap-3">
                <ApiKeyValueEditor
                  className="
                    rounded-md border border-border/40 bg-card/40 p-3 shadow-sm
                  "
                  label={
                    <>
                      <SlidersHorizontal className="size-3.5" />
                      Query Parameters
                    </>
                  }
                  values={queryParams}
                  onChange={(values) => updateApiTabRequest(activeTab.id, { queryParams: values })}
                  emptyLabel="No query params"
                  suggestions={queryParamSuggestions}
                />
                <ApiKeyValueEditor
                  className="
                    rounded-md border border-border/40 bg-card/40 p-3 shadow-sm
                  "
                  label={
                    <>
                      <KeyRound className="size-3.5" />
                      Headers
                    </>
                  }
                  values={headerParams}
                  onChange={(values) => updateApiTabRequest(activeTab.id, { headerParams: values })}
                  emptyLabel="No headers"
                  suggestions={headerParamSuggestions}
                />
              </div>

              <div className="
                flex min-h-[260px] flex-1 flex-col overflow-hidden rounded-md
                border border-border/60 bg-background/50 shadow-sm
              ">
                <div className="
                  border-b border-border/60 bg-muted/20 px-3 py-2 text-[11px]
                  text-muted-foreground select-none
                ">
                  Raw JSON overrides form input.
                </div>
                <div className="min-h-0 flex-1">
                  <Editor
                    height="100%"
                    language="json"
                    theme={monacoTheme}
                    value={body}
                    onChange={handleBodyChange}
                    options={editorOptions}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
