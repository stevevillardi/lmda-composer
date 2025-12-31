import type { ModuleSearchMatchType, ScriptMatchRange } from '@/shared/types';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildSearchRegex(
  query: string,
  matchType: ModuleSearchMatchType,
  caseSensitive: boolean
): RegExp {
  const flags = `g${caseSensitive ? '' : 'i'}`;
  if (matchType === 'regex') {
    return new RegExp(query, flags);
  }

  const escaped = escapeRegExp(query);
  if (matchType === 'exact' && /^\w+$/.test(query)) {
    return new RegExp(`\\b${escaped}\\b`, flags);
  }

  return new RegExp(escaped, flags);
}

function getLineOffsets(text: string): number[] {
  const offsets = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

function findLineIndex(offsets: number[], index: number): number {
  let low = 0;
  let high = offsets.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (offsets[mid] <= index) {
      if (mid === offsets.length - 1 || offsets[mid + 1] > index) {
        return mid;
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return 0;
}

function createRangesFromSpan(
  offsets: number[],
  start: number,
  end: number
): ScriptMatchRange[] {
  const ranges: ScriptMatchRange[] = [];
  const startLineIndex = findLineIndex(offsets, start);
  const endLineIndex = findLineIndex(offsets, Math.max(start, end - 1));

  for (let lineIndex = startLineIndex; lineIndex <= endLineIndex; lineIndex += 1) {
    const lineStartOffset = offsets[lineIndex];
    const nextLineStart = offsets[lineIndex + 1] ?? Number.POSITIVE_INFINITY;
    const lineEndOffset = Math.min(nextLineStart, end);
    const rangeStart = lineIndex === startLineIndex ? start : lineStartOffset;
    const rangeEnd = lineIndex === endLineIndex ? end : lineEndOffset;
    if (rangeEnd <= rangeStart) {
      continue;
    }
    ranges.push({
      line: lineIndex + 1,
      startColumn: rangeStart - lineStartOffset + 1,
      endColumn: rangeEnd - lineStartOffset + 1,
    });
  }

  return ranges;
}

export function findMatchRanges(
  text: string,
  query: string,
  matchType: ModuleSearchMatchType,
  caseSensitive: boolean
): ScriptMatchRange[] {
  if (!text.trim() || !query.trim()) {
    return [];
  }

  const regex = buildSearchRegex(query, matchType, caseSensitive);
  const offsets = getLineOffsets(text);
  const ranges: ScriptMatchRange[] = [];

  let match = regex.exec(text);
  while (match) {
    const start = match.index;
    const end = match.index + match[0].length;
    if (match[0].length === 0) {
      regex.lastIndex += 1;
    } else {
      ranges.push(...createRangesFromSpan(offsets, start, end));
    }
    match = regex.exec(text);
  }

  return ranges;
}

export function textMatches(
  text: string,
  query: string,
  matchType: ModuleSearchMatchType,
  caseSensitive: boolean
): boolean {
  if (!text.trim() || !query.trim()) {
    return false;
  }
  const regex = buildSearchRegex(query, matchType, caseSensitive);
  return regex.test(text);
}
