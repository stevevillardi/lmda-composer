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
import { Maximize2, Braces, FileText, ListTree, Code2, X } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { COLORS } from '@/editor/constants/colors';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { normalizeApiPath } from '@/shared/api-utils';
import { buildApiVariableResolver } from '@/editor/utils/api-variables';
import { buildMonacoOptions, getMonacoTheme } from '@/editor/utils/monaco-settings';
import '../../monaco-loader';

function formatJson(body: string): string {
  try {
    const parsed = JSON.parse(body);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return body;
  }
}

function buildUrl(portalId: string | null, path: string, queryParams: Record<string, string>) {
  const base = portalId ? `https://${portalId}` : 'https://{portal}';
  const normalizedPath = normalizeApiPath(path);
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

  const monacoTheme = useMemo(() => getMonacoTheme(preferences), [preferences]);

  const editorOptions = useMemo(() => buildMonacoOptions(preferences, {
    minimap: { enabled: false },
    wordWrap: 'on' as const,
    readOnly: true,
    padding: { top: 10, bottom: 10 },
    folding: true,
    showFoldingControls: 'always' as const,
  }), [preferences]);

  const [activeView, setActiveView] = useState('json');
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const snippets = useMemo(() => {
    if (!request) return null;
    const envVars = selectedPortalId
      ? apiEnvironmentsByPortal[selectedPortalId]?.variables ?? []
      : [];
    const resolveValue = buildApiVariableResolver(envVars);

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

  const formattedJson = useMemo(() => {
    if (!response) return '';
    return formatJson(response.body);
  }, [response]);

  if (!activeTab || activeTab.kind !== 'api') {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm select-none">
        No response to show.
      </div>
    );
  }

  const statusStyle = (() => {
    if (!response) return null;
    if (response.status >= 500) return COLORS.HTTP_STATUS.serverError;
    if (response.status >= 400) return COLORS.HTTP_STATUS.clientError;
    if (response.status >= 300) return COLORS.HTTP_STATUS.redirect;
    if (response.status >= 200) return COLORS.HTTP_STATUS.success;
    return COLORS.HTTP_STATUS.info;
  })();

  const responseCap = response?.truncated
    ? response.truncationMeta
    : null;
  const truncationMessage = (() => {
    if (!response?.truncationReason) {
      return 'Response capped to fit the size limit.';
    }
    if (response.truncationReason === 'size_limit') {
      return 'Response capped to the configured size limit.';
    }
    if (response.truncationReason === 'max_pages') {
      return 'Response capped at the maximum page limit.';
    }
    return `Response capped (${response.truncationReason}).`;
  })();

  const renderHeader = (showFullscreen: boolean, showClose: boolean) => (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground select-none">Response</span>
        {response && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge
                  className={cn(
                    "text-[10px] font-semibold select-none",
                    statusStyle?.bgSubtle,
                    statusStyle?.text
                  )}
                >
                  {response.status}
                </Badge>
              }
            />
            <TooltipContent>Status code</TooltipContent>
          </Tooltip>
        )}
        {response?.truncated && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge className="text-[10px] font-semibold bg-amber-500/15 text-amber-500 select-none">
                  Response truncated
                </Badge>
              }
            />
            <TooltipContent>{truncationMessage}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex items-center gap-2">
        {response && (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="text-xs text-muted-foreground select-none">
                  {response.durationMs}ms
                </span>
              }
            />
            <TooltipContent>Response time</TooltipContent>
          </Tooltip>
        )}
        {response?.body && activeView === 'raw' && (
          <CopyButton
            text={response.body}
            size="sm"
            variant="ghost"
            onCopy={() => toast.success('Response copied')}
          />
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
        {showClose && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setFullscreenOpen(false)}
                  aria-label="Close fullscreen"
                >
                  <X className="size-4" />
                </Button>
              }
            />
            <TooltipContent>Close fullscreen</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );

  const renderTabs = (isFullscreen: boolean) => (
    <Tabs value={activeView} onValueChange={setActiveView} className="flex-1 min-h-0 flex flex-col">
      <div className={cn(
        "px-3 pt-2 pb-1",
        isFullscreen && "bg-card"
      )}>
        <div className={cn(
          isFullscreen && "bg-muted/50 rounded-lg px-2 py-1 inline-block"
        )}>
          <TabsList variant="line">
            <TabsTrigger value="json">
              <Braces className="size-3.5 mr-1" />
              JSON
            </TabsTrigger>
            <TabsTrigger value="raw">
              <FileText className="size-3.5 mr-1" />
              Raw
            </TabsTrigger>
            <TabsTrigger value="headers">
              <ListTree className="size-3.5 mr-1" />
              Headers
            </TabsTrigger>
            <TabsTrigger value="snippets">
              <Code2 className="size-3.5 mr-1" />
              Snippets
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <TabsContent value="json" className="flex-1 min-h-0 px-3 pb-3">
        {response ? (
          <div className="h-full border border-border rounded-md overflow-hidden">
            <Editor
              height="100%"
              language="json"
              theme={monacoTheme}
              value={formattedJson}
              options={editorOptions}
            />
          </div>
        ) : (
          <Empty className="h-full border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Braces className="size-5" />
              </EmptyMedia>
              <EmptyTitle>No response yet</EmptyTitle>
              <EmptyDescription>Send a request to view the formatted JSON response.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </TabsContent>

      <TabsContent value="raw" className="flex-1 min-h-0 px-3 pb-3">
        {response ? (
          <div className="h-full min-w-0 border border-border rounded-md flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 min-h-0">
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all text-foreground">
                {response.body}
              </pre>
            </ScrollArea>
            {responseCap && (
              <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                Results capped at {responseCap.itemsFetched ?? 0} item{responseCap.itemsFetched === 1 ? '' : 's'} across {responseCap.pagesFetched ?? 0} page{responseCap.pagesFetched === 1 ? '' : 's'}.
              </div>
            )}
          </div>
        ) : (
          <Empty className="h-full border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText className="size-5" />
              </EmptyMedia>
              <EmptyTitle>No raw response</EmptyTitle>
              <EmptyDescription>Run an API request to view the raw payload.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </TabsContent>

      <TabsContent value="headers" className="flex-1 min-h-0 px-3 pb-3">
        {response ? (
          <ScrollArea className="h-full border border-border rounded-md">
            <div className="p-3 space-y-2 text-xs font-mono">
              {Object.entries(response.headers).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground select-none">{key}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <Tooltip>
                      <TooltipTrigger
                        render={<span className="text-foreground truncate">{value}</span>}
                      />
                      <TooltipContent>{value}</TooltipContent>
                    </Tooltip>
                    <CopyButton
                      text={`${key}: ${value}`}
                      size="sm"
                      variant="ghost"
                      onCopy={() => toast.success('Header copied')}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <Empty className="h-full border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListTree className="size-5" />
              </EmptyMedia>
              <EmptyTitle>No headers yet</EmptyTitle>
              <EmptyDescription>Run a request to view response headers.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </TabsContent>

      <TabsContent value="snippets" className="flex-1 min-h-0 px-3 pb-3 flex flex-col">
        {snippets ? (
          <ScrollArea className="flex-1 min-h-0 border border-border rounded-md">
            <div className="p-3 space-y-5 min-w-0">
              {Object.entries(snippets).map(([label, snippet]) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide select-none">
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
              ))}
            </div>
          </ScrollArea>
        ) : (
          <Empty className="h-full border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Code2 className="size-5" />
              </EmptyMedia>
              <EmptyTitle>No snippets yet</EmptyTitle>
              <EmptyDescription>Select a request to generate language snippets.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="h-full flex flex-col border-t border-border">
      {fullscreenOpen ? (
        <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
          <DialogContent
            className="max-w-none! w-[94vw]! h-[90vh]! min-h-0! flex! flex-col! overflow-hidden p-0"
            showCloseButton={false}
          >
            <div className="h-full min-h-0 flex flex-col">
              {renderHeader(false, true)}
              {renderTabs(true)}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col">
          {renderHeader(true, false)}
          {renderTabs(false)}
        </div>
      )}
    </div>
  );
}
