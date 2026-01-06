/**
 * Hook to handle URL parameters for deep linking.
 * 
 * Parses portal, resource, datasource, and module context from URL params
 * and applies them to the editor state.
 */

import { useState, useEffect } from 'react';
import { useEditorStore } from '../stores/editor-store';
import { ALL_LOGIC_MODULE_TYPES } from '@/shared/logic-modules';
import type { LogicModuleType } from '@/shared/types';

export interface PendingUrlContext {
  pendingResourceId: number | null;
  pendingDataSourceId: number | null;
  pendingCollectMethod: string | null;
  pendingModuleId: number | null;
  pendingModuleType: LogicModuleType | null;
  setPendingResourceId: (id: number | null) => void;
  setPendingDataSourceId: (id: number | null) => void;
  setPendingCollectMethod: (method: string | null) => void;
  setPendingModuleId: (id: number | null) => void;
  setPendingModuleType: (type: LogicModuleType | null) => void;
}

export function useUrlParamsHandler(): PendingUrlContext {
  const portals = useEditorStore((state) => state.portals);
  const setSelectedPortal = useEditorStore((state) => state.setSelectedPortal);
  
  // Track URL params application state
  const [urlParamsApplied, setUrlParamsApplied] = useState(false);
  const [pendingResourceId, setPendingResourceId] = useState<number | null>(null);
  const [pendingDataSourceId, setPendingDataSourceId] = useState<number | null>(null);
  const [pendingCollectMethod, setPendingCollectMethod] = useState<string | null>(null);
  const [pendingModuleId, setPendingModuleId] = useState<number | null>(null);
  const [pendingModuleType, setPendingModuleType] = useState<LogicModuleType | null>(null);

  // Apply URL parameters after portals are loaded
  useEffect(() => {
    // Only apply once, and only when we have portals
    if (urlParamsApplied || portals.length === 0) return;
    
    const params = new URLSearchParams(window.location.search);
    const portalParam = params.get('portal');
    const resourceIdParam = params.get('resourceId');
    const dataSourceIdParam = params.get('dataSourceId');
    const collectMethodParam = params.get('collectMethod');
    const moduleTypeParam = params.get('moduleType');
    const moduleIdParam = params.get('moduleId');
    
    if (portalParam) {
      const matchingPortal = portals.find(p => p.id === portalParam || p.hostname === portalParam);
      if (matchingPortal) {
        setSelectedPortal(matchingPortal.id);

        let hasModuleContext = false;
        if (moduleTypeParam && moduleIdParam) {
          const moduleType = ALL_LOGIC_MODULE_TYPES.find((type) => type === moduleTypeParam) || null;
          const moduleId = parseInt(moduleIdParam, 10);
          if (moduleType && !Number.isNaN(moduleId)) {
            setPendingModuleType(moduleType);
            setPendingModuleId(moduleId);
            hasModuleContext = true;
          }
        }

        if (resourceIdParam) {
          const resourceId = parseInt(resourceIdParam, 10);
          setPendingResourceId(resourceId);
        }
        if (!hasModuleContext) {
          if (dataSourceIdParam) {
            const dataSourceId = parseInt(dataSourceIdParam, 10);
            if (!Number.isNaN(dataSourceId)) {
              setPendingDataSourceId(dataSourceId);
            }
          }
          if (collectMethodParam) {
            setPendingCollectMethod(collectMethodParam);
          }
        }
      }
    }
    
    // Mark as applied so we don't do this again
    setUrlParamsApplied(true);
    
    // Clear URL params to avoid confusion on refresh
    if (portalParam || resourceIdParam || dataSourceIdParam || collectMethodParam || moduleTypeParam || moduleIdParam) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [portals, urlParamsApplied, setSelectedPortal]);

  return {
    pendingResourceId,
    pendingDataSourceId,
    pendingCollectMethod,
    pendingModuleId,
    pendingModuleType,
    setPendingResourceId,
    setPendingDataSourceId,
    setPendingCollectMethod,
    setPendingModuleId,
    setPendingModuleType,
  };
}

