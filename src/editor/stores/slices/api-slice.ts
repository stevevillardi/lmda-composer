/**
 * API slice - manages API explorer state and actions.
 * 
 * This slice handles all API Explorer functionality including:
 * - Opening API tabs
 * - Updating API request/response state
 * - Executing API requests (with pagination support)
 * - Managing API history and environments
 */

import type { StateCreator } from 'zustand';
import { apiToasts } from '../../utils/toast-utils';
import type { 
  ApiHistoryEntry,
  ApiEnvironmentState,
  ApiEnvironmentVariable,
  ApiRequestSpec,
  ApiResponseSummary,
  EditorTab,
  ExecuteApiRequest,
  ExecuteApiResponse,
  UserPreferences,
} from '@/shared/types';
import { buildApiVariableResolver } from '../../utils/api-variables';
import { appendItemsWithLimit } from '../../utils/api-pagination';
import { sendMessage } from '../../utils/chrome-messaging';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_API_HISTORY = 'lm-ide-api-history';
const STORAGE_KEY_API_ENVIRONMENTS = 'lm-ide-api-environments';

const DEFAULT_API_REQUEST: ApiRequestSpec = {
  method: 'GET',
  path: '',
  queryParams: {},
  headerParams: {},
  body: '',
  bodyMode: 'form',
  contentType: 'application/json',
  pagination: {
    enabled: false,
    sizeParam: 'size',
    offsetParam: 'offset',
    pageSize: 25,
  },
};

// ============================================================================
// Types
// ============================================================================

/**
 * State managed by the API slice.
 */
export interface APISliceState {
  apiHistoryByPortal: Record<string, ApiHistoryEntry[]>;
  apiEnvironmentsByPortal: Record<string, ApiEnvironmentState>;
  isExecutingApi: boolean;
}

/**
 * Actions provided by the API slice.
 */
export interface APISliceActions {
  openApiExplorerTab: () => string;
  updateApiTabRequest: (tabId: string, request: Partial<ApiRequestSpec>) => void;
  setApiTabResponse: (tabId: string, response: ApiResponseSummary | null) => void;
  executeApiRequest: (tabId?: string) => Promise<void>;
  addApiHistoryEntry: (portalId: string, entry: Omit<ApiHistoryEntry, 'id'>) => void;
  clearApiHistory: (portalId?: string) => void;
  loadApiHistory: () => Promise<void>;
  setApiEnvironment: (portalId: string, variables: ApiEnvironmentVariable[]) => void;
  loadApiEnvironments: () => Promise<void>;
}

/**
 * Combined slice interface.
 */
export interface APISlice extends APISliceState, APISliceActions {}

/**
 * Dependencies from other slices that APISlice needs access to.
 */
export interface APISliceDependencies {
  // From TabsSlice
  tabs: EditorTab[];
  activeTabId: string | null;
  // From PortalSlice
  selectedPortalId: string | null;
  // From UISlice
  preferences: UserPreferences;
  setActiveWorkspace: (workspace: 'script' | 'api') => void;
}

// ============================================================================
// Initial State
// ============================================================================

export const apiSliceInitialState: APISliceState = {
  apiHistoryByPortal: {},
  apiEnvironmentsByPortal: {},
  isExecutingApi: false,
};

// ============================================================================
// Helper Functions
// ============================================================================

function createDefaultApiTab(): EditorTab {
  return {
    id: crypto.randomUUID(),
    kind: 'api',
    displayName: 'API Request',
    content: '',
    language: 'groovy',
    mode: 'freeform',
    source: { type: 'api' },
    api: {
      request: { ...DEFAULT_API_REQUEST },
    },
  };
}

// ============================================================================
// Slice Creator
// ============================================================================

/**
 * Creates the API slice with full implementations.
 */
export const createAPISlice: StateCreator<
  APISlice & APISliceDependencies,
  [],
  [],
  APISlice
> = (set, get) => ({
  ...apiSliceInitialState,

  openApiExplorerTab: () => {
    const { tabs, setActiveWorkspace } = get();
    const newTab = createDefaultApiTab();
    const baseName = 'API Request';
    let displayName = baseName;
    let counter = 2;
    while (tabs.some(tab => tab.displayName === displayName)) {
      displayName = `${baseName} ${counter}`;
      counter += 1;
    }
    newTab.displayName = displayName;
    // Switch to API workspace when opening an API tab
    setActiveWorkspace('api');
    set({
      tabs: [...tabs, newTab],
      activeTabId: newTab.id,
    } as Partial<APISlice & APISliceDependencies>);
    return newTab.id;
  },

  updateApiTabRequest: (tabId, request) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(tab => {
        if (tab.id !== tabId || tab.kind !== 'api') return tab;
        const currentRequest = { ...DEFAULT_API_REQUEST, ...(tab.api?.request ?? {}) };
        return {
          ...tab,
          api: {
            ...(tab.api ?? { request: currentRequest }),
            request: {
              ...currentRequest,
              ...request,
            },
          },
        };
      }),
    } as Partial<APISlice & APISliceDependencies>);
  },

  setApiTabResponse: (tabId, response) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(tab => {
        if (tab.id !== tabId || tab.kind !== 'api') return tab;
        return {
          ...tab,
          api: {
            ...(tab.api ?? { request: DEFAULT_API_REQUEST }),
            response: response ?? undefined,
          },
        };
      }),
    } as Partial<APISlice & APISliceDependencies>);
  },

  executeApiRequest: async (tabId) => {
    const { tabs, activeTabId, selectedPortalId, preferences, apiEnvironmentsByPortal } = get();
    const targetTabId = tabId ?? activeTabId;
    if (!targetTabId) return;

    const tab = tabs.find(t => t.id === targetTabId);
    if (!tab || tab.kind !== 'api' || !tab.api) return;

    if (!selectedPortalId) {
      apiToasts.noPortalSelected();
      return;
    }

    const request = tab.api.request;
    const envVars = apiEnvironmentsByPortal[selectedPortalId]?.variables ?? [];
    const resolveValue = buildApiVariableResolver(envVars);

    const baseRequest: ApiRequestSpec = { ...DEFAULT_API_REQUEST, ...request };
    const resolvedRequest: ApiRequestSpec = {
      ...baseRequest,
      path: resolveValue(baseRequest.path),
      body: resolveValue(baseRequest.body),
      queryParams: Object.fromEntries(
        Object.entries(baseRequest.queryParams).map(([key, value]) => [key, resolveValue(value)])
      ),
      headerParams: Object.fromEntries(
        Object.entries(baseRequest.headerParams).map(([key, value]) => [key, resolveValue(value)])
      ),
    };

    set({ isExecutingApi: true });
    const startedAt = Date.now();

    const executeSingle = async (req: ApiRequestSpec): Promise<ExecuteApiResponse> => {
      const result = await sendMessage({
        type: 'EXECUTE_API_REQUEST',
        payload: {
          portalId: selectedPortalId,
          method: req.method,
          path: req.path,
          queryParams: req.queryParams,
          headerParams: req.headerParams,
          body: req.body,
          contentType: req.contentType,
        } satisfies ExecuteApiRequest,
      });

      if (result.ok) {
        return result.data as ExecuteApiResponse;
      }
      throw new Error(result.error || 'API request failed.');
    };

    try {
      let finalPayload: ExecuteApiResponse | null = null;
      let finalBody = '';

      let truncationReason: string | undefined;
      let truncationMeta: ApiResponseSummary['truncationMeta'];

      if (resolvedRequest.pagination.enabled) {
        const sizeParam = resolvedRequest.pagination.sizeParam || 'size';
        const offsetParam = resolvedRequest.pagination.offsetParam || 'offset';
        const pageSize = Math.max(25, resolvedRequest.pagination.pageSize || 25);
        const maxPages = 50;
        let offset = 0;
        let total: number | null = null;
        const capEnabled = preferences.apiResponseSizeLimit > 0;
        const limit = capEnabled ? preferences.apiResponseSizeLimit : Number.POSITIVE_INFINITY;
        let aggregationState = { items: [] as unknown[], estimatedBytes: 0, truncated: false };
        let pagesFetched = 0;

        for (let page = 0; page < maxPages; page += 1) {
          const pagedRequest: ApiRequestSpec = {
            ...resolvedRequest,
            queryParams: {
              ...resolvedRequest.queryParams,
              [sizeParam]: String(pageSize),
              [offsetParam]: String(offset),
            },
          };

          const payload = await executeSingle(pagedRequest);
          finalPayload = payload;
          finalBody = payload.body;
          pagesFetched += 1;

          let parsed: unknown;
          try {
            parsed = JSON.parse(payload.body);
          } catch {
            break;
          }

          const items = Array.isArray((parsed as Record<string, unknown>)?.items) 
            ? (parsed as Record<string, unknown[]>).items 
            : Array.isArray((parsed as Record<string, unknown>)?.data) 
              ? (parsed as Record<string, unknown[]>).data 
              : null;
          if (!items) {
            break;
          }

          if (capEnabled) {
            aggregationState = appendItemsWithLimit(aggregationState, items, limit);
          } else {
            aggregationState.items.push(...items);
          }
          if (typeof (parsed as Record<string, unknown>)?.total === 'number') {
            total = (parsed as Record<string, number>).total;
          }

          if (aggregationState.truncated) {
            truncationReason = 'size_limit';
            break;
          }

          if (items.length < pageSize) {
            break;
          }

          offset += pageSize;
          if (total !== null && offset >= total) {
            break;
          }
        }

        if (finalPayload && aggregationState.items.length > 0) {
          if (!truncationReason && pagesFetched >= maxPages) {
            const hasMorePages = total !== null ? offset < total : true;
            if (hasMorePages) {
              truncationReason = 'max_pages';
            }
          }
          if (truncationReason) {
            truncationMeta = {
              itemsFetched: aggregationState.items.length,
              pagesFetched,
              limit: preferences.apiResponseSizeLimit,
            };
          }

          const aggregated = {
            items: aggregationState.items,
            total: total ?? aggregationState.items.length,
            pageSize,
            pages: Math.ceil((total ?? aggregationState.items.length) / pageSize),
            ...(truncationReason ? {
              _meta: {
                truncated: true,
                reason: truncationReason,
                itemsFetched: aggregationState.items.length,
                pagesFetched,
                limit: preferences.apiResponseSizeLimit,
              },
            } : {}),
          };
          finalBody = JSON.stringify(aggregated, null, 2);
        }
      } else {
        finalPayload = await executeSingle(resolvedRequest);
        finalBody = finalPayload.body;
      }

      if (!finalPayload) {
        throw new Error('No API response received.');
      }

      let jsonPreview: unknown | undefined;
      try {
        const parsed = JSON.parse(finalBody);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed)) {
            jsonPreview = parsed.slice(0, 20);
          } else {
            jsonPreview = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).slice(0, 50));
          }
        }
      } catch {
        jsonPreview = undefined;
      }

      const limit = preferences.apiResponseSizeLimit;
      const trimmedBody = limit > 0 && finalBody.length > limit
        ? finalBody.slice(0, limit)
        : finalBody;

      let effectiveTruncationReason = truncationReason;
      let effectiveTruncationMeta = truncationMeta;
      if (!effectiveTruncationReason && limit > 0 && finalBody.length > limit) {
        effectiveTruncationReason = 'size_limit';
        effectiveTruncationMeta = undefined;
      }

      const summary: ApiResponseSummary = {
        status: finalPayload.status,
        headers: finalPayload.headers,
        body: trimmedBody,
        jsonPreview,
        durationMs: Date.now() - startedAt,
        timestamp: Date.now(),
        truncated: Boolean(effectiveTruncationReason),
        truncationReason: effectiveTruncationReason,
        truncationMeta: effectiveTruncationMeta,
      };

      set({
        tabs: tabs.map(t => 
          t.id === targetTabId
            ? {
              ...t,
              api: {
                ...(t.api ?? { request }),
                response: summary,
              },
            }
            : t
        ),
      } as Partial<APISlice & APISliceDependencies>);

      get().addApiHistoryEntry(selectedPortalId, {
        portalId: selectedPortalId,
        request: resolvedRequest,
        response: summary,
      });
    } catch (error) {
      console.error('Failed to execute API request:', error);
      apiToasts.requestFailed(error instanceof Error ? error : undefined);
    } finally {
      set({ isExecutingApi: false });
    }
  },

  addApiHistoryEntry: (portalId, entry) => {
    const { apiHistoryByPortal, preferences } = get();
    const existing = apiHistoryByPortal[portalId] ?? [];
    const newEntry: ApiHistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      portalId,
    };
    const updatedPortalHistory = [newEntry, ...existing].slice(0, preferences.apiHistoryLimit);
    const updatedHistory = {
      ...apiHistoryByPortal,
      [portalId]: updatedPortalHistory,
    };
    set({ apiHistoryByPortal: updatedHistory });
    chrome.storage.local.set({ [STORAGE_KEY_API_HISTORY]: updatedHistory }).catch(console.error);
  },

  clearApiHistory: (portalId) => {
    const { apiHistoryByPortal } = get();
    if (portalId) {
      const updated = { ...apiHistoryByPortal };
      delete updated[portalId];
      set({ apiHistoryByPortal: updated });
      chrome.storage.local.set({ [STORAGE_KEY_API_HISTORY]: updated }).catch(console.error);
      return;
    }
    set({ apiHistoryByPortal: {} });
    chrome.storage.local.remove(STORAGE_KEY_API_HISTORY).catch(console.error);
  },

  loadApiHistory: async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY_API_HISTORY);
      const stored = result[STORAGE_KEY_API_HISTORY] as Record<string, ApiHistoryEntry[]> | undefined;
      if (stored) {
        set({ apiHistoryByPortal: stored });
      }
    } catch (error) {
      console.error('Failed to load API history:', error);
    }
  },

  setApiEnvironment: (portalId, variables) => {
    const envState: ApiEnvironmentState = {
      portalId,
      variables,
      lastModified: Date.now(),
    };
    const updated = {
      ...get().apiEnvironmentsByPortal,
      [portalId]: envState,
    };
    set({ apiEnvironmentsByPortal: updated });
    chrome.storage.local.set({ [STORAGE_KEY_API_ENVIRONMENTS]: updated }).catch(console.error);
  },

  loadApiEnvironments: async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY_API_ENVIRONMENTS);
      const stored = result[STORAGE_KEY_API_ENVIRONMENTS] as Record<string, ApiEnvironmentState> | undefined;
      if (stored) {
        set({ apiEnvironmentsByPortal: stored });
      }
    } catch (error) {
      console.error('Failed to load API environments:', error);
    }
  },
});
