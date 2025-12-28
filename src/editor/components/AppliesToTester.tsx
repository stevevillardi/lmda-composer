import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { 
  Search,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Play,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { APPLIES_TO_FUNCTIONS } from '../data/applies-to-functions';
import type { AppliesToFunction } from '@/shared/types';

export function AppliesToTester() {
  const {
    appliesToTesterOpen,
    setAppliesToTesterOpen,
    appliesToExpression,
    setAppliesToExpression,
    appliesToResults,
    appliesToError,
    isTestingAppliesTo,
    testAppliesTo,
    clearAppliesToResults,
    appliesToFunctionSearch,
    setAppliesToFunctionSearch,
    selectedPortalId,
  } = useEditorStore();

  const [functionRefOpen, setFunctionRefOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [cursorWordStart, setCursorWordStart] = useState(0);
  const [currentWord, setCurrentWord] = useState('');

  // Filter functions based on search
  const filteredFunctions = useMemo(() => {
    if (!appliesToFunctionSearch.trim()) return APPLIES_TO_FUNCTIONS;
    const query = appliesToFunctionSearch.toLowerCase();
    return APPLIES_TO_FUNCTIONS.filter(
      f => f.name.toLowerCase().includes(query) || 
           f.description.toLowerCase().includes(query)
    );
  }, [appliesToFunctionSearch]);

  // Get suggestions based on current word being typed
  const suggestions = useMemo(() => {
    if (!currentWord || currentWord.length < 1) return [];
    const word = currentWord.toLowerCase();
    return APPLIES_TO_FUNCTIONS
      .filter(f => f.name.toLowerCase().startsWith(word))
      .slice(0, 8);
  }, [currentWord]);

  // Extract word at cursor position
  const extractWordAtCursor = useCallback((text: string, cursorPos: number) => {
    // Find the start of the current word
    let start = cursorPos;
    while (start > 0 && /[a-zA-Z_]/.test(text[start - 1])) {
      start--;
    }
    
    // Get the word from start to cursor
    const word = text.slice(start, cursorPos);
    return { word, start };
  }, []);

  // Handle textarea change
  const handleExpressionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setAppliesToExpression(newValue);
    
    // Extract word at cursor for autocomplete
    const cursorPos = e.target.selectionStart;
    const { word, start } = extractWordAtCursor(newValue, cursorPos);
    
    setCurrentWord(word);
    setCursorWordStart(start);
    setShowSuggestions(word.length >= 1);
    setSuggestionIndex(0);
  };

  // Handle selecting a suggestion
  const selectSuggestion = useCallback((func: AppliesToFunction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const text = appliesToExpression;
    const cursorPos = textarea.selectionStart;
    
    // Build the insertion text
    const insertText = func.syntax.includes('()') ? func.syntax : func.name;
    
    // Replace the current word with the function
    const newText = text.slice(0, cursorWordStart) + insertText + text.slice(cursorPos);
    setAppliesToExpression(newText);
    
    // Move cursor to appropriate position (inside parentheses if applicable)
    const parenPos = insertText.indexOf('(');
    const newCursorPos = cursorWordStart + (parenPos > -1 ? parenPos + 1 : insertText.length);
    
    setShowSuggestions(false);
    setCurrentWord('');
    
    // Focus and set cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [appliesToExpression, cursorWordStart, setAppliesToExpression]);

  // Handle keyboard navigation in suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      // Allow Enter to submit if not showing suggestions
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        testAppliesTo();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSuggestionIndex(i => Math.min(i + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSuggestionIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        selectSuggestion(suggestions[suggestionIndex]);
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Handle copy device ID
  const handleCopy = async (id: number) => {
    await navigator.clipboard.writeText(id.toString());
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Insert function syntax into expression
  const insertFunction = (func: AppliesToFunction) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setAppliesToExpression(appliesToExpression + func.syntax);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = appliesToExpression;
    
    // Add space before if not at start and previous char isn't a space or operator
    const needsSpaceBefore = start > 0 && !/[\s(&|!]/.test(text[start - 1]);
    const prefix = needsSpaceBefore ? ' ' : '';
    
    const newText = text.slice(0, start) + prefix + func.syntax + text.slice(end);
    setAppliesToExpression(newText);
    
    // Move cursor inside parentheses if applicable
    const parenPos = func.syntax.indexOf('(');
    const newCursorPos = start + prefix.length + (parenPos > -1 ? parenPos + 1 : func.syntax.length);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <Dialog open={appliesToTesterOpen} onOpenChange={setAppliesToTesterOpen}>
      <DialogContent className="!w-[90vw] !max-w-[90vw] h-[90vh] flex flex-col gap-0 p-0" showCloseButton>
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle>AppliesTo Toolbox</DialogTitle>
          <DialogDescription>
            Test AppliesTo expressions against resources in your portal
          </DialogDescription>
        </DialogHeader>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0 border-t border-border">
          {/* Top section: Expression + Results (side by side) */}
          <div className="flex-1 flex min-h-0">
            {/* Left Panel - Expression Input */}
            <div className="w-1/2 flex flex-col border-r border-border p-4 gap-4">
              {/* Expression textarea */}
              <div className="flex-1 flex flex-col gap-2 min-h-0">
                <Label htmlFor="expression" className="text-sm font-medium">
                  Expression
                </Label>
                <div className="relative flex-1 min-h-0">
                  <Textarea
                    ref={textareaRef}
                    id="expression"
                    value={appliesToExpression}
                    onChange={handleExpressionChange}
                    onKeyDown={handleKeyDown}
                    placeholder='hasCategory("Linux") && isDevice()'
                    className="h-full min-h-[120px] font-mono text-sm resize-none"
                  />
                  
                  {/* Autocomplete suggestions dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto">
                      {suggestions.map((func, index) => (
                        <button
                          key={func.name}
                          onClick={() => selectSuggestion(func)}
                          className={cn(
                            "w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent",
                            index === suggestionIndex && "bg-accent"
                          )}
                        >
                          <span className="font-mono font-medium">{func.name}</span>
                          <span className="text-muted-foreground text-xs truncate flex-1">
                            {func.description.slice(0, 50)}...
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Test button */}
              <div className="flex items-center justify-end">
                <Button
                  onClick={testAppliesTo}
                  disabled={isTestingAppliesTo || !selectedPortalId || !appliesToExpression.trim()}
                  className="gap-2"
                >
                  {isTestingAppliesTo ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  {isTestingAppliesTo ? 'Testing...' : 'Test AppliesTo'}
                </Button>
              </div>
            </div>

            {/* Right Panel - Results */}
            <div className="w-1/2 flex flex-col p-4 gap-2">
              {/* Results header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Results</Label>
                  {appliesToError ? (
                    <Badge variant="destructive" className="font-mono">
                      Error
                    </Badge>
                  ) : appliesToResults.length > 0 ? (
                    <Badge variant="secondary" className="font-mono">
                      {appliesToResults.length} match{appliesToResults.length !== 1 ? 'es' : ''}
                    </Badge>
                  ) : null}
                </div>
                {(appliesToResults.length > 0 || appliesToError) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAppliesToResults}
                    className="gap-1.5 text-muted-foreground"
                  >
                    <Trash2 className="size-3.5" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Results list */}
              <div className="flex-1 min-h-0 overflow-auto border border-border rounded-md bg-muted/20">
                {/* Error display - show in results area */}
                {appliesToError ? (
                  <div className="h-full flex flex-col">
                    <div className="flex items-start gap-3 p-4 bg-destructive/10 border-b border-destructive/20">
                      <AlertCircle className="size-5 text-destructive mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-destructive mb-2">Expression Error</div>
                        <pre className="text-sm text-destructive/90 whitespace-pre-wrap font-mono">
                          {appliesToError}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : appliesToResults.length === 0 ? (
                  <Empty className="h-full border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        {isTestingAppliesTo ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Search />
                        )}
                      </EmptyMedia>
                      <EmptyTitle className="text-base">
                        {isTestingAppliesTo ? 'Testing...' : 'No Results Yet'}
                      </EmptyTitle>
                      <EmptyDescription>
                        {isTestingAppliesTo 
                          ? 'Evaluating your AppliesTo expression'
                          : 'Enter an expression and click "Test AppliesTo" to see matching resources'
                        }
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="divide-y divide-border">
                    {appliesToResults.map((match) => (
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

              {/* Success indicator when results exist */}
              {appliesToResults.length > 0 && !appliesToError && (
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <CheckCircle2 className="size-4" />
                  <span>Expression is valid</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom section: Function Reference (collapsible) */}
          <Collapsible
            open={functionRefOpen}
            onOpenChange={setFunctionRefOpen}
            className="border-t border-border"
          >
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-3 hover:bg-accent/50 transition-colors">
              {functionRefOpen ? (
                <ChevronDown className="size-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground" />
              )}
              <HelpCircle className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Function Reference</span>
              <Badge variant="secondary" className="ml-2 text-xs">
                {APPLIES_TO_FUNCTIONS.length} functions
              </Badge>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-4 pb-4">
                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search functions..."
                    value={appliesToFunctionSearch}
                    onChange={(e) => setAppliesToFunctionSearch(e.target.value)}
                    className="pl-8 h-8"
                  />
                </div>
                
                {/* Functions grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-auto">
                  {filteredFunctions.map((func) => (
                    <FunctionCard
                      key={func.name}
                      func={func}
                      onInsert={() => insertFunction(func)}
                    />
                  ))}
                </div>
                
                {filteredFunctions.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-4">
                    No functions match your search
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface FunctionCardProps {
  func: AppliesToFunction;
  onInsert: () => void;
}

function FunctionCard({ func, onInsert }: FunctionCardProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            onClick={onInsert}
            className="w-full text-left p-2 rounded-md border border-border hover:bg-accent/50 transition-colors"
          >
            <div className="font-mono text-xs font-medium text-primary truncate">
              {func.syntax}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {func.description.slice(0, 80)}...
            </div>
          </button>
        }
      />
      <TooltipContent side="top" className="max-w-sm">
        <div className="space-y-1">
          <div className="font-mono font-medium">{func.syntax}</div>
          {func.parameters !== 'None' && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Parameters:</span> {func.parameters}
            </div>
          )}
          <div className="text-xs">{func.description}</div>
          {func.example && (
            <div className="text-xs text-muted-foreground mt-1">
              <span className="font-medium">Example:</span> <code>{func.example}</code>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

