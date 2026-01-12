/**
 * Hook to auto-open scripts based on URL parameters.
 * 
 * Consolidates the logic for opening scripts from:
 * - Device datasource links (datasourceId + collectMethod)
 * - Module links (moduleType + moduleId)
 * - Resource context (resourceId)
 */

import { useEffect } from 'react';
import { moduleToasts, portalToasts } from '../utils/toast-utils';
import { useEditorStore } from '../stores/editor-store';
import type { PendingUrlContext } from './useUrlParamsHandler';
import type { LogicModuleInfo, LogicModuleType, ScriptType } from '@/shared/types';

/**
 * Helper to normalize module script type from API response.
 */
function normalizeModuleScriptType(raw?: string): ScriptType {
  const normalized = (raw || '').toLowerCase();
  if (normalized === 'powershell') return 'powerShell';
  if (normalized === 'file') return 'file';
  if (normalized === 'embed' || normalized === 'embedded') return 'embed';
  return 'embed';
}

/**
 * Helper to extract scripts from different module type API responses.
 */
function buildModuleScriptsFromResponse(
  module: Record<string, unknown>,
  moduleType: LogicModuleType
): { moduleInfo: LogicModuleInfo; scripts: Array<{ type: 'ad' | 'collection'; content: string }> } | null {
  const moduleId = module.id as number | undefined;
  const moduleName = module.name as string | undefined;
  if (!moduleId || !moduleName) return null;

  let collectionScript = '';
  let adScript = '';
  let scriptType: ScriptType = 'embed';
  let collectMethod = (module.collectMethod as string | undefined) || 'script';
  let appliesTo = (module.appliesTo as string | undefined) || '';
  let hasAutoDiscovery = false;

  if (moduleType === 'propertysource' || moduleType === 'diagnosticsource' || moduleType === 'eventsource') {
    collectionScript = (module.groovyScript as string | undefined) || '';
    scriptType = normalizeModuleScriptType(module.scriptType as string | undefined);
    collectMethod = 'script';
  } else if (moduleType === 'logsource') {
    appliesTo = (module.appliesToScript as string | undefined) || appliesTo;
    collectMethod = ((module.collectionMethod as string | undefined) || collectMethod).toLowerCase();
    const collectionAttribute = module.collectionAttribute as {
      script?: { embeddedContent?: string; type?: string };
      groovyScript?: string;
      scriptType?: string;
    } | undefined;
    collectionScript = collectionAttribute?.script?.embeddedContent
      || collectionAttribute?.groovyScript
      || '';
    scriptType = normalizeModuleScriptType(
      collectionAttribute?.script?.type
        || collectionAttribute?.scriptType
        || (module.scriptType as string | undefined)
    );
  } else {
    const collectorAttribute = module.collectorAttribute as { groovyScript?: string; scriptType?: string } | undefined;
    collectionScript = collectorAttribute?.groovyScript || '';
    scriptType = normalizeModuleScriptType(collectorAttribute?.scriptType || (module.scriptType as string | undefined));

    if (moduleType !== 'topologysource') {
      const adMethod = (module.autoDiscoveryConfig as { method?: { groovyScript?: string } } | undefined)?.method;
      if (adMethod) {
        adScript = adMethod.groovyScript || '';
        hasAutoDiscovery = !!adScript.trim();
      }
    }
  }

  const moduleInfo: LogicModuleInfo = {
    id: moduleId,
    name: moduleName,
    displayName: (module.displayName as string | undefined) || moduleName,
    moduleType,
    appliesTo,
    collectMethod,
    hasAutoDiscovery,
    scriptType,
    lineageId: module.lineageId as string | undefined,
  };

  const scripts: Array<{ type: 'ad' | 'collection'; content: string }> = [];
  if (collectionScript.trim()) {
    scripts.push({ type: 'collection', content: collectionScript });
  }
  if (adScript.trim()) {
    scripts.push({ type: 'ad', content: adScript });
  }

  return { moduleInfo, scripts };
}

/**
 * Hook that processes pending URL parameters and auto-opens scripts.
 * 
 * @param urlContext - The pending URL context from useUrlParamsHandler
 */
export function useAutoOpenScripts(urlContext: PendingUrlContext): void {
  const {
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
  } = urlContext;

  const portals = useEditorStore((state) => state.portals);
  const selectedPortalId = useEditorStore((state) => state.selectedPortalId);
  const openModuleScripts = useEditorStore((state) => state.openModuleScripts);
  const switchToPortalWithContext = useEditorStore((state) => state.switchToPortalWithContext);

  // Auto-open scripts for device datasource links (script/batchscript only)
  useEffect(() => {
    const openFromDeviceDatasource = async () => {
      if (!pendingDataSourceId || !pendingCollectMethod) return;
      if (pendingCollectMethod !== 'script' && pendingCollectMethod !== 'batchscript') {
        moduleToasts.notScriptBased(pendingCollectMethod);
        setPendingDataSourceId(null);
        setPendingCollectMethod(null);
        return;
      }

      if (!selectedPortalId) return;

      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_MODULE',
        payload: { portalId: selectedPortalId, moduleType: 'datasource', moduleId: pendingDataSourceId },
      });

      if (response?.type === 'MODULE_FETCHED' && response.payload) {
        const module = response.payload;
        const scriptType: ScriptType = module?.collectorAttribute?.scriptType ?? 'embed';
        const moduleInfo: LogicModuleInfo = {
          id: module.id,
          name: module.name,
          displayName: module.displayName,
          moduleType: 'datasource',
          appliesTo: module.appliesTo ?? '',
          collectMethod: module.collectMethod ?? pendingCollectMethod,
          hasAutoDiscovery: !!module.autoDiscoveryConfig,
          scriptType,
          lineageId: module.lineageId,
        };

        const scripts: Array<{ type: 'ad' | 'collection'; content: string }> = [];
        const collectionScript = module?.collectorAttribute?.groovyScript;
        const adScript = module?.autoDiscoveryConfig?.method?.groovyScript;

        if (collectionScript) {
          scripts.push({ type: 'collection', content: collectionScript });
        }
        if (adScript) {
          scripts.push({ type: 'ad', content: adScript });
        }

        if (scripts.length > 0) {
          openModuleScripts(moduleInfo, scripts);
          moduleToasts.openedFromDevice(module.displayName || module.name);
        }
      }

      setPendingDataSourceId(null);
      setPendingCollectMethod(null);
    };

    openFromDeviceDatasource();
  }, [
    pendingDataSourceId,
    pendingCollectMethod,
    openModuleScripts,
    selectedPortalId,
    setPendingDataSourceId,
    setPendingCollectMethod,
  ]);

  // Auto-open scripts for module links (LMX module tabs)
  useEffect(() => {
    const openFromModuleContext = async () => {
      if (!pendingModuleId || !pendingModuleType) return;
      if (!selectedPortalId) return;

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'FETCH_MODULE',
          payload: { portalId: selectedPortalId, moduleType: pendingModuleType, moduleId: pendingModuleId },
        });

        if (response?.type === 'MODULE_FETCHED' && response.payload) {
          const parsed = buildModuleScriptsFromResponse(response.payload, pendingModuleType);
          if (parsed && parsed.scripts.length > 0) {
            openModuleScripts(parsed.moduleInfo, parsed.scripts);
            const portal = portals.find(p => p.id === selectedPortalId);
            moduleToasts.openedFromContext(
              parsed.moduleInfo.displayName || parsed.moduleInfo.name,
              portal?.hostname ?? selectedPortalId ?? ''
            );
          }
        }
      } catch (error) {
        console.error('Failed to open module scripts from context:', error);
      } finally {
        setPendingModuleId(null);
        setPendingModuleType(null);
      }
    };

    openFromModuleContext();
  }, [
    pendingModuleId,
    pendingModuleType,
    openModuleScripts,
    portals,
    selectedPortalId,
    setPendingModuleId,
    setPendingModuleType,
  ]);

  // Apply resource context when a resourceId is present
  useEffect(() => {
    const applyResourceContext = async () => {
      if (!pendingResourceId || !selectedPortalId) return;

      const response = await chrome.runtime.sendMessage({
        type: 'GET_DEVICE_BY_ID',
        payload: { portalId: selectedPortalId, resourceId: pendingResourceId },
      });

      if (response?.type === 'DEVICE_BY_ID_LOADED') {
        const device = response.payload;
        if (device.currentCollectorId) {
          await switchToPortalWithContext(selectedPortalId, {
            collectorId: device.currentCollectorId,
            hostname: device.name,
          });
          const portal = portals.find(p => p.id === selectedPortalId);
          portalToasts.contextApplied(
            portal?.hostname ?? selectedPortalId ?? '',
            device.currentCollectorId,
            device.name
          );
        }
      }
      setPendingResourceId(null);
    };

    applyResourceContext();
  }, [
    pendingResourceId,
    portals,
    selectedPortalId,
    switchToPortalWithContext,
    setPendingResourceId,
  ]);
}
