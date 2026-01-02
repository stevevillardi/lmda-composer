import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Play, Loader2, AlertCircle, CheckCircle2, Trash2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { APPLIES_TO_OPERATORS, type AppliesToOperator } from '../data/applies-to-operators';
import { APPLIES_TO_FUNCTIONS } from '../data/applies-to-functions';
import type { AppliesToFunction } from '@/shared/types';
import { useEditorStore } from '../stores/editor-store';

interface AppliesToEditorSlimProps {
  value: string;
  onChange: (value: string) => void;
  onTest?: () => void;
  results?: Array<{ type: string; id: number; name: string }>;
  error?: string | null;
  isTesting?: boolean;
}

export function AppliesToEditorSlim({
  value,
  onChange,
  onTest,
  results = [],
  error = null,
  isTesting = false,
}: AppliesToEditorSlimProps) {
  const { testAppliesTo, clearAppliesToResults, selectedPortalId } = useEditorStore();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [cursorWordStart, setCursorWordStart] = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [hasTested, setHasTested] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevValueRef = useRef(value);

  // Reset tested state when value prop changes externally
  useEffect(() => {
    if (prevValueRef.current !== value) {
      setHasTested(false);
      prevValueRef.current = value;
    }
  }, [value]);

  useEffect(() => {
    if (!showSuggestions) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && containerRef.current?.contains(target)) {
        return;
      }
      setShowSuggestions(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showSuggestions]);

  // Get all functions (built-in only for slim version)
  const allFunctions = useMemo(() => {
    return APPLIES_TO_FUNCTIONS;
  }, []);

  // Enhanced word extraction
  const extractWordAtCursor = useCallback((text: string, cursorPos: number) => {
    // Check if we're inside a string literal
    let inString = false;
    let stringChar = '';
    for (let i = 0; i < cursorPos; i++) {
      if ((text[i] === '"' || text[i] === "'") && (i === 0 || text[i - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = text[i];
        } else if (text[i] === stringChar) {
          inString = false;
          stringChar = '';
        }
      }
    }
    
    if (inString) {
      let start = cursorPos;
      while (start > 0 && text[start - 1] !== stringChar) {
        start--;
      }
      return { word: text.slice(start, cursorPos), start };
    }

    // Check for operators
    const operatorPatterns = ['==', '!=', '>=', '<=', '=~', '!~', '&&', '||'];
    for (const op of operatorPatterns) {
      if (cursorPos >= op.length && text.slice(cursorPos - op.length, cursorPos) === op) {
        return { word: op, start: cursorPos - op.length };
      }
    }

    // Find the start of the current word
    let start = cursorPos;
    while (start > 0 && /[a-zA-Z_]/.test(text[start - 1])) {
      start--;
    }
    
    return { word: text.slice(start, cursorPos), start };
  }, []);

  // Get suggestions
  const suggestions = useMemo(() => {
    if (!currentWord || currentWord.length < 1) {
      return [];
    }
    
    const word = currentWord.toLowerCase();
    const results: Array<AppliesToFunction | AppliesToOperator> = [];
    
    // Add function matches
    const functionMatches = allFunctions
      .filter(f => f.name.toLowerCase().startsWith(word))
      .slice(0, 5);
    results.push(...functionMatches);
    
    // Add operator matches
    const operatorMatches = APPLIES_TO_OPERATORS
      .filter(op => {
        if (op.symbol.length === 1) return false;
        const symbol = op.symbol.toLowerCase();
        return symbol.startsWith(word) || 
               op.alternatives?.some(alt => alt.toLowerCase().startsWith(word));
      })
      .slice(0, 3);
    results.push(...operatorMatches);
    
    return results;
  }, [currentWord, allFunctions]);

  const handleExpressionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    const cursorPos = e.target.selectionStart;
    const wordContext = extractWordAtCursor(newValue, cursorPos);
    setCurrentWord(wordContext.word);
    setCursorWordStart(wordContext.start);
    
    if (wordContext.word.length > 0) {
      setShowSuggestions(true);
      setSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectSuggestion(suggestions[suggestionIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowSuggestions(false);
      }
    }
  };

  const selectSuggestion = (item: AppliesToFunction | AppliesToOperator) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const isFunction = 'name' in item;
    const insertText = isFunction ? (item as AppliesToFunction).name : (item as AppliesToOperator).symbol;
    
    const before = value.slice(0, cursorWordStart);
    const after = value.slice(textarea.selectionStart);
    const newValue = before + insertText + after;
    
    onChange(newValue);
    setShowSuggestions(false);
    
    const newCursorPos = cursorWordStart + insertText.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleTest = async () => {
    setHasTested(false);
    if (onTest) {
      await onTest();
    } else {
      await testAppliesTo();
    }
    // Mark as tested after completion
    setHasTested(true);
  };

  const handleCopy = (id: number) => {
    navigator.clipboard.writeText(id.toString());
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const displayResults = results.length > 0 ? results : [];
  const displayError = error;
  const displayIsTesting = isTesting;
  
  // Show empty state if we've tested, not currently testing, no error, and no results
  const showEmptyState = hasTested && !displayIsTesting && !displayError && displayResults.length === 0;

  return (
    <div className="space-y-4">
      {/* Expression Input */}
      <div className="space-y-2">
        <Label htmlFor="applies-to-expression" className="text-sm font-medium">
          Applies To
        </Label>
        <div className="relative" ref={containerRef}>
          <Textarea
            ref={textareaRef}
            id="applies-to-expression"
            value={value}
            onChange={handleExpressionChange}
            onKeyDown={handleKeyDown}
            onSelect={(e) => {
              const textarea = e.target as HTMLTextAreaElement;
              const cursorPos = textarea.selectionStart;
              const wordContext = extractWordAtCursor(value, cursorPos);
              setCurrentWord(wordContext.word);
              setCursorWordStart(wordContext.start);
            }}
            onMouseUp={(e) => {
              const textarea = e.target as HTMLTextAreaElement;
              const cursorPos = textarea.selectionStart;
              const wordContext = extractWordAtCursor(value, cursorPos);
              setCurrentWord(wordContext.word);
              setCursorWordStart(wordContext.start);
            }}
            placeholder='hasCategory("Linux") && isDevice()'
            className="min-h-[120px] font-mono text-sm resize-none"
          />
          
          {/* Autocomplete suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto">
              {suggestions.map((item, index) => {
                const isFunction = 'name' in item;
                const displayName = isFunction ? (item as AppliesToFunction).name : (item as AppliesToOperator).symbol;
                const description = isFunction 
                  ? (item as AppliesToFunction).description
                  : (item as AppliesToOperator).description;
                
                const matchedPart = displayName.slice(0, currentWord.length);
                const remainingPart = displayName.slice(currentWord.length);
                
                return (
                  <button
                    key={isFunction ? (item as AppliesToFunction).name : (item as AppliesToOperator).symbol}
                    onClick={() => selectSuggestion(item)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent transition-colors",
                      index === suggestionIndex && "bg-accent"
                    )}
                  >
                    <Badge variant={isFunction ? 'default' : 'secondary'} className="text-xs font-mono">
                      <span className="font-semibold">{matchedPart}</span>
                      <span className="opacity-70">{remainingPart}</span>
                    </Badge>
                    <span className="text-muted-foreground text-xs truncate flex-1">
                      {description.slice(0, 60)}
                      {description.length > 60 && '...'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Test Button */}
      <div className="flex items-center justify-end gap-2">
        <Button
          onClick={handleTest}
          disabled={displayIsTesting || !selectedPortalId || !value.trim()}
          className="gap-2"
        >
          {displayIsTesting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          {displayIsTesting ? 'Testing...' : 'Test AppliesTo'}
        </Button>
      </div>

      {/* Results */}
      {(displayResults.length > 0 || displayError || displayIsTesting || showEmptyState) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Results</Label>
              {displayError ? (
                <Badge variant="destructive" className="font-mono">
                  Error
                </Badge>
              ) : displayResults.length > 0 ? (
                <Badge variant="secondary" className="font-mono">
                  {displayResults.length} match{displayResults.length !== 1 ? 'es' : ''}
                </Badge>
              ) : null}
            </div>
            {(displayResults.length > 0 || displayError || showEmptyState) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearAppliesToResults();
                  setHasTested(false);
                }}
                className="gap-1.5 text-muted-foreground"
              >
                <Trash2 className="size-3.5" />
                Clear
              </Button>
            )}
          </div>

          <div className="border border-border rounded-md bg-muted/20 min-h-[200px] max-h-[300px] overflow-auto">
            {displayError ? (
              <div className="flex items-start gap-3 p-4 bg-destructive/10">
                <AlertCircle className="size-5 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-destructive mb-2">Expression Error</div>
                  <pre className="text-sm text-destructive/90 whitespace-pre-wrap font-mono">
                    {displayError}
                  </pre>
                </div>
              </div>
            ) : displayIsTesting ? (
              <Empty className="h-full border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Loader2 className="animate-spin" />
                  </EmptyMedia>
                  <EmptyTitle className="text-base">Testing...</EmptyTitle>
                  <EmptyDescription>
                    Evaluating your AppliesTo expression
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : showEmptyState ? (
              <Empty className="h-full border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CheckCircle2 className="text-green-500" />
                  </EmptyMedia>
                  <EmptyTitle className="text-base">No Matches Found</EmptyTitle>
                  <EmptyDescription>
                    The expression ran successfully but did not match any resources.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : displayResults.length === 0 ? null : (
              <div className="divide-y divide-border">
                {displayResults.map((match) => (
                  <div 
                    key={match.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors group"
                  >
                    <Badge variant="outline" className="shrink-0 font-mono text-xs">
                      {match.type}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground shrink-0 w-16 text-right">
                      #{match.id}
                    </span>
                    <span className="text-sm truncate flex-1" title={match.name}>
                      {match.name}
                    </span>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleCopy(match.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          >
                            {copiedId === match.id ? (
                              <Check className="size-3 text-green-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </Button>
                        }
                      />
                      <TooltipContent>Copy ID</TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}
          </div>

          {displayResults.length > 0 && !displayError && (
            <div className="flex items-center gap-2 text-sm text-green-500">
              <CheckCircle2 className="size-4" />
              <span>Expression is valid</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
