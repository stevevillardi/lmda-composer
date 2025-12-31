import { useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useEditorStore } from '@/editor/stores/editor-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CopyButton } from '../shared/CopyButton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import '../../monaco-loader';

function formatJson(body: string): string {
  try {
    const parsed = JSON.parse(body);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return body;
  }
}

function normalizePath(path: string) {
  const trimmed = path.startsWith('/') ? path : `/${path}`;
  if (trimmed.startsWith('/santaba/rest')) {
    return trimmed;
  }
  return `/santaba/rest${trimmed}`;
}

function buildUrl(portalId: string | null, path: string, queryParams: Record<string, string>) {
  const base = portalId ? `https://${portalId}` : 'https://{portal}';
  const normalizedPath = normalizePath(path);
  const url = new URL(`${base}${normalizedPath}`);
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function buildCurlSnippet(method: string, url: string, headers: Record<string, string>, body?: string) {
  const headerLines = Object.entries(headers).map(
    ([key, value]) => `  -H "${key}: ${value}"`
  );
  const bodyLine = body ? `  --data '${body.replace(/'/g, "'\\''")}'` : '';
  return [
    `curl -X ${method} \\`,
    `  "${url}" \\`,
    ...headerLines,
    bodyLine,
  ].filter(Boolean).join('\n');
}

function buildPythonSnippet(method: string, url: string, headers: Record<string, string>, body?: string) {
  const payload = body ? `payload = ${body}` : 'payload = None';
  const headersText = JSON.stringify(headers, null, 2);
  return [
    'import requests',
    '',
    `url = "${url}"`,
    `headers = ${headersText}`,
    payload,
    '',
    `response = requests.request("${method}", url, headers=headers, data=payload)`,
    'print(response.status_code)',
    'print(response.text)',
  ].join('\n');
}

function buildPowerShellSnippet(method: string, url: string, headers: Record<string, string>, body?: string) {
  const headersText = Object.entries(headers)
    .map(([key, value]) => `"${key}" = "${value}"`)
    .join('\n  ');
  const bodyLine = body ? `-Body '${body.replace(/'/g, "''")}'` : '';
  return [
    `$headers = @{`,
    `  ${headersText}`,
    `}`,
    `Invoke-RestMethod -Method ${method} -Uri "${url}" -Headers $headers ${bodyLine}`,
  ].join('\n');
}

function buildGroovySnippet(method: string, url: string, headers: Record<string, string>, body?: string) {
  const headerLines = Object.entries(headers)
    .map(([key, value]) => `connection.setRequestProperty("${key}", "${value}")`)
    .join('\n');
  const bodyBlock = body
    ? [
        'connection.doOutput = true',
        'connection.outputStream.withWriter("UTF-8") { it << payload }',
      ].join('\n')
    : '';

  return [
    `def url = new URL("${url}")`,
    `def connection = (HttpURLConnection) url.openConnection()`,
    `connection.requestMethod = "${method}"`,
    headerLines,
    body ? `def payload = '${body.replace(/'/g, "''")}'` : '',
    bodyBlock,
    'def response = connection.inputStream.text',
    'println response',
  ].filter(Boolean).join('\n');
}

export function ApiResponseViewer() {
  const {
    tabs,
    activeTabId,
    preferences,
    selectedPortalId,
    apiEnvironmentsByPortal,
  } = useEditorStore();

  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);

  const response = activeTab?.api?.response;
  const request = activeTab?.api?.request;

  const monacoTheme = useMemo(() => {
    if (preferences.theme === 'light') return 'vs';
    if (preferences.theme === 'dark') return 'vs-dark';
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'vs';
    }
    return 'vs-dark';
  }, [preferences.theme]);

  const editorOptions = useMemo(() => ({
    fontSize: preferences.fontSize,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    minimap: { enabled: false },
    wordWrap: 'on' as const,
    readOnly: true,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    padding: { top: 10, bottom: 10 },
  }), [preferences.fontSize]);

  const [activeView, setActiveView] = useState('json');
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const snippets = useMemo(() => {
    if (!request) return null;
    const envVars = selectedPortalId
      ? apiEnvironmentsByPortal[selectedPortalId]?.variables ?? []
      : [];
    const resolveValue = (value: string) => {
      if (!value) return value;
      return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
        const variable = envVars.find(v => v.key === key);
        return variable ? variable.value : match;
      });
    };

    const resolvedPath = resolveValue(request.path);
    const resolvedQueryParams = Object.fromEntries(
      Object.entries(request.queryParams).map(([key, value]) => [key, resolveValue(value)])
    );
    const resolvedHeaders = Object.fromEntries(
      Object.entries(request.headerParams).map(([key, value]) => [key, resolveValue(value)])
    );
    const resolvedBody = resolveValue(request.body);
    const normalizedBody = resolvedBody.trim();
    const isEmptyJsonBody = (() => {
      if (!normalizedBody) return true;
      try {
        const parsed = JSON.parse(normalizedBody);
        if (Array.isArray(parsed)) return parsed.length === 0;
        if (parsed && typeof parsed === 'object') {
          return Object.keys(parsed).length === 0;
        }
        return false;
      } catch {
        return false;
      }
    })();
    const bodyForSnippet = isEmptyJsonBody ? '' : resolvedBody;
    const url = buildUrl(selectedPortalId, resolvedPath, resolvedQueryParams);
    const headers: Record<string, string> = {
      'X-version': '3',
      Authorization: 'Bearer <bearer-token>',
      ...resolvedHeaders,
    };
    if (bodyForSnippet && bodyForSnippet.trim().length > 0) {
      headers['Content-Type'] = request.contentType;
    }
    return {
      curl: buildCurlSnippet(request.method, url, headers, bodyForSnippet),
      python: buildPythonSnippet(request.method, url, headers, bodyForSnippet),
      powershell: buildPowerShellSnippet(request.method, url, headers, bodyForSnippet),
      groovy: buildGroovySnippet(request.method, url, headers, bodyForSnippet),
    };
  }, [request, selectedPortalId, apiEnvironmentsByPortal]);

  if (!activeTab || activeTab.kind !== 'api') {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        No response to show.
      </div>
    );
  }

  const renderHeader = (showFullscreen: boolean) => (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Response</span>
        {response && (
          <Badge variant={response.status >= 400 ? 'destructive' : 'secondary'}>
            {response.status}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        {response && (
          <span className="text-xs text-muted-foreground">
            {response.durationMs}ms
          </span>
        )}
        {response && showFullscreen && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setFullscreenOpen(true)}
                  aria-label="Open response fullscreen"
                >
                  <Maximize2 className="size-4" />
                </Button>
              }
            />
            <TooltipContent>Open fullscreen</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );

  const responseTabs = (
    <Tabs value={activeView} onValueChange={setActiveView} className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 pt-2">
        <TabsList variant="line">
          <TabsTrigger value="json">JSON</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
          <TabsTrigger value="headers">Headers</TabsTrigger>
          <TabsTrigger value="snippets">Snippets</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="json" className="flex-1 min-h-0 px-3 pb-3">
        <div className="h-full border border-border rounded-md overflow-hidden">
          <Editor
            height="100%"
            language="json"
            theme={monacoTheme}
            value={response ? formatJson(response.body) : ''}
            options={editorOptions}
          />
        </div>
      </TabsContent>

      <TabsContent value="raw" className="flex-1 min-h-0 px-3 pb-3">
        <div className="h-full min-w-0 border border-border rounded-md flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-[11px] text-muted-foreground">Raw response</span>
            {response?.body && (
              <CopyButton
                text={response.body}
                size="sm"
                variant="ghost"
                onCopy={() => toast.success('Response copied')}
              />
            )}
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all text-foreground">
              {response?.body || 'No response yet.'}
            </pre>
          </ScrollArea>
        </div>
      </TabsContent>

      <TabsContent value="headers" className="flex-1 min-h-0 px-3 pb-3">
        <ScrollArea className="h-full border border-border rounded-md">
          <div className="p-3 space-y-2 text-xs font-mono">
            {response ? (
              Object.entries(response.headers).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{key}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-foreground truncate">{value}</span>
                    <CopyButton
                      text={`${key}: ${value}`}
                      size="sm"
                      variant="ghost"
                      onCopy={() => toast.success('Header copied')}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">No headers yet.</div>
            )}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="snippets" className="flex-1 min-h-0 px-3 pb-3 flex flex-col">
        <ScrollArea className="flex-1 min-h-0 border border-border rounded-md">
          <div className="p-3 space-y-5 min-w-0">
            {snippets ? (
              Object.entries(snippets).map(([label, snippet]) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">
                      {label}
                    </div>
                    <CopyButton
                      text={snippet}
                      size="sm"
                      variant="ghost"
                      onCopy={() => toast.success('Snippet copied')}
                    />
                  </div>
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all text-foreground bg-muted/40 border border-border rounded-md p-3">
                    {snippet}
                  </pre>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground text-sm">No request selected.</div>
            )}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="h-full flex flex-col border-t border-border">
      <div className={fullscreenOpen ? 'hidden' : 'flex flex-1 min-h-0 flex-col'}>
        {renderHeader(true)}
        {responseTabs}
      </div>

      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="!max-w-none !w-[94vw] !h-[90vh] !min-h-0 !flex !flex-col overflow-hidden p-0">
          <div className="h-full min-h-0 flex flex-col">
            {renderHeader(false)}
            {responseTabs}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
