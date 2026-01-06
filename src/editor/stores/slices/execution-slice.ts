/**
 * Execution slice - manages script execution state.
 * 
 * This slice is a placeholder for future extraction from editor-store.ts.
 * The actual implementation remains in editor-store.ts for now.
 */

import type { StateCreator } from 'zustand';
import type { ExecutionResult, ExecutionHistoryEntry } from '@/shared/types';
import type { ParseResult } from '../../utils/output-parser';
import type { editor } from 'monaco-editor';

// ============================================================================
// Types
// ============================================================================

/**
 * State managed by the execution slice.
 */
export interface ExecutionSliceState {
  isExecuting: boolean;
  currentExecution: ExecutionResult | null;
  parsedOutput: ParseResult | null;
  editorInstance: editor.IStandaloneCodeEditor | null;
  currentExecutionId: string | null;
  executionHistory: ExecutionHistoryEntry[];
}

/**
 * Actions provided by the execution slice.
 */
export interface ExecutionSliceActions {
  setEditorInstance: (editor: editor.IStandaloneCodeEditor | null) => void;
  executeScript: () => Promise<void>;
  parseCurrentOutput: () => void;
  clearOutput: () => void;
  cancelExecution: () => Promise<void>;
  addToHistory: (entry: Omit<ExecutionHistoryEntry, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  loadHistory: () => Promise<void>;
  reloadFromHistory: (entry: ExecutionHistoryEntry) => void;
  reloadFromHistoryWithoutBinding: (entry: ExecutionHistoryEntry) => void;
}

/**
 * Combined slice interface.
 */
export interface ExecutionSlice extends ExecutionSliceState, ExecutionSliceActions {}

// ============================================================================
// Initial State
// ============================================================================

export const executionSliceInitialState: ExecutionSliceState = {
  isExecuting: false,
  currentExecution: null,
  parsedOutput: null,
  editorInstance: null,
  currentExecutionId: null,
  executionHistory: [],
};

// ============================================================================
// Slice Creator (Placeholder)
// ============================================================================

/**
 * Creates the execution slice.
 * 
 * Note: This is a placeholder. The actual implementation is still in editor-store.ts.
 * This file defines the types and initial state for future extraction.
 */
export const createExecutionSlice: StateCreator<
  ExecutionSlice,
  [],
  [],
  ExecutionSlice
> = (set) => ({
  ...executionSliceInitialState,

  // Placeholder implementations - actual logic is in editor-store.ts
  setEditorInstance: (editorInstance) => set({ editorInstance }),
  executeScript: async () => { /* Implemented in editor-store.ts */ },
  parseCurrentOutput: () => { /* Implemented in editor-store.ts */ },
  clearOutput: () => set({ currentExecution: null, parsedOutput: null }),
  cancelExecution: async () => { /* Implemented in editor-store.ts */ },
  addToHistory: () => { /* Implemented in editor-store.ts */ },
  clearHistory: () => set({ executionHistory: [] }),
  loadHistory: async () => { /* Implemented in editor-store.ts */ },
  reloadFromHistory: () => { /* Implemented in editor-store.ts */ },
  reloadFromHistoryWithoutBinding: () => { /* Implemented in editor-store.ts */ },
});

