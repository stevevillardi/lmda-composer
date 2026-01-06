/**
 * Types for service worker message handlers.
 */

import type { PortalManager } from '../portal-manager';
import type { ScriptExecutor } from '../script-executor';
import type { ApiExecutor } from '../api-executor';
import type { ModuleLoader } from '../module-loader';

/**
 * Context provided to all message handlers.
 */
export interface HandlerContext {
  portalManager: PortalManager;
  scriptExecutor: ScriptExecutor;
  apiExecutor: ApiExecutor;
  moduleLoader: ModuleLoader;
  activeModuleSearches: Map<string, AbortController>;
}

/**
 * Response sender function type.
 */
export type SendResponse = (response: unknown) => void;

/**
 * Message handler function type.
 */
export type MessageHandler<TPayload = unknown> = (
  payload: TPayload,
  sendResponse: SendResponse,
  context: HandlerContext
) => Promise<void> | void;

