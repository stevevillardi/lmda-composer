/**
 * Shared helper functions for Zustand slices.
 * 
 * These utilities are used across multiple slices to reduce duplication
 * and ensure consistent behavior.
 */

import type { EditorTab, Portal } from '@/shared/types';
import { getPortalBindingStatus } from '../../utils/portal-binding';

/**
 * Type guard for checking if a value is a plain object.
 */
export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Deep equality check for objects and arrays.
 */
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => deepEqual(a[key], b[key]));
  }
  return false;
};

/**
 * Portal binding result with portal ID for use in actions.
 */
export interface PortalBindingResult {
  isActive: boolean;
  portalId: string;
  reason?: string;
}

/**
 * Ensures the portal binding is active for a module tab.
 * Throws an error if the portal is not active.
 * 
 * @param tab - The editor tab to check
 * @param selectedPortalId - Currently selected portal ID
 * @param portals - List of available portals
 * @returns The portal binding result with the active portal ID
 * @throws Error if the portal is not active
 */
export function ensurePortalBindingActive(
  tab: EditorTab,
  selectedPortalId: string | null,
  portals: Portal[]
): PortalBindingResult {
  const binding = getPortalBindingStatus(tab, selectedPortalId, portals);
  if (!binding.isActive) {
    throw new Error(binding.reason || 'Portal is not active for this tab.');
  }
  return binding as PortalBindingResult;
}

/**
 * Gets all tab IDs that belong to the same module as the given tab.
 * Used to sync state across module tabs (e.g., AD and Collection scripts from same module).
 * 
 * @param tabs - All open tabs
 * @param tabId - The tab ID to find related tabs for
 * @returns Array of tab IDs that belong to the same module
 */
export function getModuleTabIds(tabs: EditorTab[], tabId: string): string[] {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab || tab.source?.type !== 'module' || !tab.source.moduleId || !tab.source.moduleType) {
    return [tabId];
  }
  const source = tab.source;
  const portalId = source.portalId;
  return tabs
    .filter(
      (t) =>
        t.source?.type === 'module' &&
        t.source.moduleId === source.moduleId &&
        t.source.moduleType === source.moduleType &&
        t.source.portalId === portalId
    )
    .map((t) => t.id);
}

/**
 * Normalizes a script string for comparison.
 * Trims whitespace and normalizes line endings (CRLF -> LF).
 * 
 * @param s - The string to normalize
 * @returns Normalized string
 */
export function normalizeScript(s: string): string {
  return s.trim().replace(/\r\n/g, '\n');
}

/**
 * Normalizes access group IDs to a sorted array of numbers.
 * Handles both array and comma-separated string inputs.
 * 
 * @param value - Array of IDs or comma-separated string
 * @returns Sorted array of numeric IDs
 */
export function normalizeAccessGroupIds(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value
      .map((id) => (typeof id === 'string' ? parseInt(id, 10) : id))
      .filter((id) => typeof id === 'number' && !Number.isNaN(id))
      .sort((a, b) => a - b);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
  }
  return [];
}

