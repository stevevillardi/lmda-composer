import type { ScriptMode } from '@/shared/types';

const VALID_MODES: ScriptMode[] = ['freeform', 'ad', 'collection', 'batchcollection'];

/**
 * Normalizes script mode values to ensure they are valid.
 * 
 * Maps legacy modes (topology, config, event, property, log, batchconfig) 
 * that were removed in a UX simplification to 'collection'.
 * 
 * @param mode - The mode value to normalize
 * @returns A valid ScriptMode value
 */
export function normalizeMode(mode: ScriptMode | string): ScriptMode {
  if (VALID_MODES.includes(mode as ScriptMode)) {
    return mode as ScriptMode;
  }
  // Legacy modes were all collection-type scripts
  return 'collection';
}

/**
 * Checks if a mode value is valid (one of the 4 supported modes)
 */
export function isValidMode(mode: string): mode is ScriptMode {
  return VALID_MODES.includes(mode as ScriptMode);
}

