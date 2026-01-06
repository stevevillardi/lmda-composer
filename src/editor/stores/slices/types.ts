/**
 * Shared types for store slices.
 * 
 * This file defines the slice creator pattern and shared utility types
 * for the modular store architecture.
 */

import type { StateCreator } from 'zustand';

/**
 * Type for slice state creators.
 * Allows each slice to access the full store state while defining its own slice.
 */
export type SliceCreator<TSlice, TFullState = unknown> = StateCreator<
  TFullState,
  [],
  [],
  TSlice
>;

/**
 * Utility type to extract the state part from a slice creator.
 */
export type SliceState<T> = T extends SliceCreator<infer S, unknown> ? S : never;

/**
 * Helper to create a typed slice creator.
 */
export function createSlice<TSlice, TFullState>(
  creator: SliceCreator<TSlice, TFullState>
): SliceCreator<TSlice, TFullState> {
  return creator;
}

