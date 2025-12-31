import { useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '@/editor/stores/editor-store';
import { ApiKeyValueEditor } from './ApiKeyValueEditor';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import type { ApiRequestMethod } from '@/shared/types';
import { API_SCHEMA } from '@/editor/data/api-schema';
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

  const editorOptions = useMemo(() => buildMonacoOptions(preferences, {
    minimap: { enabled: false },
    wordWrap: 'on' as const,
    tabSize: preferences.tabSize,
    insertSpaces: true,
    padding: { top: 10, bottom: 10 },
  }), [preferences]);

  const endpoint = useMemo(() => {
    return API_SCHEMA.endpoints.find((entry) => entry.method === method && entry.path === path);
  }, [method, path]);

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

  const updateTabName = (nextMethod: ApiRequestMethod, nextPath: string) => {
    if (!activeTabId || !activeTab) return;
    if (!activeTab.displayName.startsWith('API Request')) return;
    const trimmedPath = nextPath.trim();
    const label = trimmedPath ? `${nextMethod} ${trimmedPath}` : 'API Request';
    renameTab(activeTabId, label);
  };

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
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Select an API tab to begin.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 h-12 border-b border-border">
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

        <Input
          value={path}
          onChange={(event) => {
            const nextPath = event.target.value;
            updateApiTabRequest(activeTab.id, { path: nextPath });
            updateTabName(method, nextPath);
          }}
          placeholder="/santaba/rest/device/devices"
          className="h-8 flex-1 font-mono text-xs"
        />

      </div>

      <div className="flex-1 min-h-0 grid grid-rows-[auto_1fr]">
        <Tabs
          value={bodyMode}
          onValueChange={(value) => updateApiTabRequest(activeTab.id, { bodyMode: value as 'form' | 'raw' })}
          className="h-full min-h-0 flex flex-col"
        >
          <div className="px-3 pt-3 shrink-0">
            <TabsList variant="line">
              <TabsTrigger value="form">Form</TabsTrigger>
              <TabsTrigger value="raw">Raw JSON</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="form" className="flex-1 min-h-0 px-3 pb-3 flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                <ApiKeyValueEditor
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

              <div className="border border-border rounded-md bg-background">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-xs text-muted-foreground select-none">JSON Body (form)</span>
                  <Badge variant="outline" className="text-[10px] select-none">application/json</Badge>
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

          <TabsContent value="raw" className="flex-1 min-h-0 px-3 pb-3 flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                <ApiKeyValueEditor
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

              <div className="border border-border rounded-md overflow-hidden flex flex-col flex-1 min-h-[260px]">
                <div className="px-3 py-2 border-b border-border text-[11px] text-muted-foreground select-none">
                  Raw JSON overrides form input.
                </div>
                <div className="flex-1 min-h-0">
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
