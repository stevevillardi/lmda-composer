/**
 * Client-side validation utilities for module fields.
 */

import type { LogicModuleType } from '@/shared/types';

/**
 * Module types that have the displayName hyphen restriction.
 * Both DataSource and ConfigSource cannot have hyphens in displayName except as the last character.
 */
const DISPLAY_NAME_HYPHEN_RESTRICTED_TYPES: LogicModuleType[] = ['datasource', 'configsource'];

/**
 * Validates displayName for module types that have hyphen restrictions.
 * DataSource and ConfigSource displayName cannot contain hyphens except as the last character.
 * 
 * @param displayName - The display name to validate
 * @param moduleType - The type of module being validated
 * @returns Error message if invalid, null if valid
 */
export function validateModuleDisplayName(displayName: string, moduleType: LogicModuleType): string | null {
  if (!displayName) return null;
  
  // Only validate for module types with this restriction
  if (!DISPLAY_NAME_HYPHEN_RESTRICTED_TYPES.includes(moduleType)) return null;
  
  // Check if there's a hyphen that's not at the last position
  for (let i = 0; i < displayName.length - 1; i++) {
    if (displayName[i] === '-') {
      return 'Display name cannot contain hyphens except as the last character';
    }
  }
  
  return null;
}
