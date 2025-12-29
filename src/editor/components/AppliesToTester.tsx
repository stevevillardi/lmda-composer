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
  Save,
  Download,
  Hammer,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { APPLIES_TO_OPERATORS, getOperatorsByCategory, type AppliesToOperator } from '../data/applies-to-operators';
import { CreateFunctionDialog } from './AppliesToTester/CreateFunctionDialog';
import { UpdateFunctionConfirmationDialog } from './AppliesToTester/UpdateFunctionConfirmationDialog';
import type { AppliesToFunction, CustomAppliesToFunction } from '@/shared/types';

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
    customFunctions,
    isLoadingCustomFunctions,
    customFunctionError,
    isCreatingFunction,
    isUpdatingFunction,
    isDeletingFunction,
    fetchCustomFunctions,
    createCustomFunction,
    updateCustomFunction,
    deleteCustomFunction,
    getAllFunctions,
  } = useEditorStore();

  const [functionRefOpen, setFunctionRefOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [loadedFunction, setLoadedFunction] = useState<CustomAppliesToFunction | null>(null);
  const [updateConfirmationOpen, setUpdateConfirmationOpen] = useState(false);
  const [deletingFunctionId, setDeletingFunctionId] = useState<number | null>(null);
  const [showOnlyCustom, setShowOnlyCustom] = useState(false);

  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [cursorWordStart, setCursorWordStart] = useState(0);
  const [currentWord, setCurrentWord] = useState('');

  // Fetch custom functions when dialog opens
  useEffect(() => {
    if (appliesToTesterOpen && selectedPortalId) {
      fetchCustomFunctions();
    }
  }, [appliesToTesterOpen, selectedPortalId, fetchCustomFunctions]);

  // Get all functions (built-in + custom)
  const allFunctions = useMemo(() => {
    return getAllFunctions();
  }, [getAllFunctions, customFunctions]);

  // Fix type issues - ensure allFunctions has proper types
  const typedAllFunctions = useMemo(() => {
    return allFunctions.map((f: any) => ({
      ...f,
      source: f.source || 'builtin',
      customId: f.customId,
    }));
  }, [allFunctions]);

  // Filter functions based on search and custom/builtin toggle
  const filteredFunctions = useMemo(() => {
    let functions = typedAllFunctions;
    
    // Filter by custom/builtin toggle
    if (showOnlyCustom) {
      functions = functions.filter((f: any) => f.source === 'custom');
    }
    
    // Filter by search query
    if (appliesToFunctionSearch.trim()) {
      const query = appliesToFunctionSearch.toLowerCase();
      functions = functions.filter(
        (f: any) => f.name.toLowerCase().includes(query) || 
             f.description.toLowerCase().includes(query)
      );
    }
    
    return functions;
  }, [appliesToFunctionSearch, typedAllFunctions, showOnlyCustom]);

  // Enhanced word detection with context awareness
  interface WordContext {
    word: string;
    start: number;
    end: number;
    type: 'function' | 'operator' | 'string' | 'unknown';
    context: 'afterFunction' | 'afterOperator' | 'afterParen' | 'start' | 'normal';
  }

  // Enhanced word extraction with operator and context detection
  const extractWordAtCursor = useCallback((text: string, cursorPos: number): WordContext => {
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
      // Find string boundaries
      let start = cursorPos;
      while (start > 0 && text[start - 1] !== stringChar) {
        start--;
      }
      return {
        word: text.slice(start, cursorPos),
        start,
        end: cursorPos,
        type: 'string',
        context: 'normal',
      };
    }

    // Check for operators (multi-character first, then single)
    const operatorPatterns = ['==', '!=', '>=', '<=', '=~', '!~', '&&', '||'];
    for (const op of operatorPatterns) {
      if (cursorPos >= op.length && text.slice(cursorPos - op.length, cursorPos) === op) {
        return {
          word: op,
          start: cursorPos - op.length,
          end: cursorPos,
          type: 'operator',
          context: 'normal',
        };
      }
    }

    // Check for single character operators
    const singleCharOps = ['>', '<', '=', '!', '&', '|', '(', ')'];
    if (cursorPos > 0 && singleCharOps.includes(text[cursorPos - 1])) {
      return {
        word: text[cursorPos - 1],
        start: cursorPos - 1,
        end: cursorPos,
        type: 'operator',
        context: 'normal',
      };
    }

    // Check for text operators (and, or)
    const textOps = ['and', 'or'];
    for (const op of textOps) {
      const start = cursorPos - op.length;
      if (start >= 0 && text.slice(start, cursorPos).toLowerCase() === op) {
        // Check if it's a complete word
        const before = start > 0 ? text[start - 1] : ' ';
        const after = cursorPos < text.length ? text[cursorPos] : ' ';
        if (!/[a-zA-Z_]/.test(before) && !/[a-zA-Z_]/.test(after)) {
          return {
            word: text.slice(start, cursorPos),
            start,
            end: cursorPos,
            type: 'operator',
            context: 'normal',
          };
        }
      }
    }

    // Find the start of the current word (function name)
    let start = cursorPos;
    while (start > 0 && /[a-zA-Z_]/.test(text[start - 1])) {
      start--;
    }
    
    const word = text.slice(start, cursorPos);
    
    // Determine context
    let context: WordContext['context'] = 'normal';
    if (start > 0) {
      const before = text.slice(0, start).trim();
      if (before.endsWith('(')) {
        context = 'afterParen';
      } else if (/[=!<>~&|]/.test(before[before.length - 1])) {
        context = 'afterOperator';
      } else if (/[a-zA-Z_]\s*$/.test(before)) {
        context = 'afterFunction';
      } else if (before.length === 0) {
        context = 'start';
      }
    } else {
      context = 'start';
    }

    return {
      word,
      start,
      end: cursorPos,
      type: 'function',
      context,
    };
  }, []);

  // Get suggestions including both functions and operators
  const suggestions = useMemo(() => {
    if (!currentWord || currentWord.length < 1) {
      // If no word, suggest operators based on context
      return [];
    }
    
    const word = currentWord.toLowerCase();
    const results: Array<AppliesToFunction | AppliesToOperator> = [];
    
    // Add function matches (built-in + custom)
    const functionMatches = typedAllFunctions
      .filter((f: any) => f.name.toLowerCase().startsWith(word))
      .slice(0, 5);
    results.push(...functionMatches);
    
    // Add operator matches (exclude single-character operators like (, ), !, >, <)
    const operatorMatches = APPLIES_TO_OPERATORS
      .filter(op => {
        // Skip single-character operators - they're complete on their own
        if (op.symbol.length === 1) return false;
        const symbol = op.symbol.toLowerCase();
        return symbol.startsWith(word) || 
               op.alternatives?.some(alt => alt.toLowerCase().startsWith(word));
      })
      .slice(0, 3);
    results.push(...operatorMatches);
    
    return results;
  }, [currentWord, typedAllFunctions]);


  // Handle textarea change
  const handleExpressionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setAppliesToExpression(newValue);
    
    // Extract word at cursor for autocomplete
    const cursorPos = e.target.selectionStart;
    const wordContext = extractWordAtCursor(newValue, cursorPos);
    
    setCurrentWord(wordContext.word);
    setCursorWordStart(wordContext.start);
    
    // Calculate suggestions inline
    let currentSuggestions: Array<AppliesToFunction | AppliesToOperator> = [];
    if (wordContext.word.length >= 1) {
      const word = wordContext.word.toLowerCase();
      
      // Add function matches (built-in + custom)
      const functionMatches = typedAllFunctions
        .filter((f: any) => f.name.toLowerCase().startsWith(word))
        .slice(0, 5);
      currentSuggestions.push(...functionMatches);
      
      // Add operator matches (exclude single-character operators like (, ), !, >, <)
      const operatorMatches = APPLIES_TO_OPERATORS
        .filter(op => {
          // Skip single-character operators - they're complete on their own
          if (op.symbol.length === 1) return false;
          const symbol = op.symbol.toLowerCase();
          return symbol.startsWith(word) || 
                 op.alternatives?.some(alt => alt.toLowerCase().startsWith(word));
        })
        .slice(0, 3);
      currentSuggestions.push(...operatorMatches);
    }
    
    setShowSuggestions(currentSuggestions.length > 0);
    setSuggestionIndex(0);
  };

  // Handle selecting a suggestion (function or operator)
  const selectSuggestion = useCallback((item: AppliesToFunction | AppliesToOperator) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const text = appliesToExpression;
    const cursorPos = textarea.selectionStart;
    
    // Build the insertion text
    let insertText: string;
    let selectionStart: number | null = null;
    let selectionEnd: number | null = null;
    
    if ('name' in item) {
      // Function
      const func = item as AppliesToFunction;
      // Always use the full syntax if available
      insertText = func.syntax || func.name;
      
      // Check if function has parameters
      const hasNoParams = func.parameters === 'None' || !func.parameters || func.parameters.trim() === '';
      
      if (!hasNoParams && insertText.includes('(')) {
        // Find the first placeholder (e.g., <array>, <property value>, "<property name>")
        // Look for patterns like <...> or "<...>"
        const placeholderPattern = /<[^>]+>|"[^"]*<[^>]+>[^"]*"/;
        const match = insertText.match(placeholderPattern);
        
        if (match && match.index !== undefined) {
          // Select the placeholder text
          selectionStart = cursorWordStart + match.index;
          selectionEnd = cursorWordStart + match.index + match[0].length;
        } else {
          // If no placeholder found, place cursor after opening parenthesis
          const parenPos = insertText.indexOf('(');
          selectionStart = cursorWordStart + parenPos + 1;
          selectionEnd = selectionStart;
        }
      } else if (hasNoParams) {
        // Functions with no parameters: place cursor after closing parenthesis
        selectionStart = cursorWordStart + insertText.length;
        selectionEnd = selectionStart;
      } else {
        // Fallback: place cursor at end
        selectionStart = cursorWordStart + insertText.length;
        selectionEnd = selectionStart;
      }
    } else {
      // Operator
      const op = item as AppliesToOperator;
      insertText = op.symbol;
      selectionStart = cursorWordStart + insertText.length;
      selectionEnd = selectionStart;
    }
    
    // Replace the current word with the selected item
    const newText = text.slice(0, cursorWordStart) + insertText + text.slice(cursorPos);
    setAppliesToExpression(newText);
    
    setShowSuggestions(false);
    setCurrentWord('');
    
    // Focus and set cursor/selection position
    setTimeout(() => {
      textarea.focus();
      if (selectionStart !== null && selectionEnd !== null) {
        textarea.setSelectionRange(selectionStart, selectionEnd);
      }
    }, 0);
  }, [appliesToExpression, cursorWordStart, setAppliesToExpression]);

  // Handle keyboard navigation in suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Escape - close suggestions but NOT the modal
    if (e.key === 'Escape') {
      if (showSuggestions) {
        e.preventDefault();
        e.stopPropagation(); // Prevent dialog from closing
        setShowSuggestions(false);
        return;
      }
      // If no suggestions, let Escape work normally (close modal)
      return;
    }

    if (!showSuggestions || suggestions.length === 0) {
      // Allow Enter to submit if not showing suggestions
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        testAppliesTo();
      }
      // Allow regular Tab to work normally
      if (e.key === 'Tab') {
        return; // Let browser handle default Tab behavior
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
        selectSuggestion(suggestions[suggestionIndex] as AppliesToFunction | AppliesToOperator);
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

  // Handle load function into editor
  const handleLoadFunction = (func: CustomAppliesToFunction) => {
    setAppliesToExpression(func.code);
    setLoadedFunction(func);
    clearAppliesToResults();
    toast.success(`Function "${func.name}" loaded into editor`);
  };

  // Handle unload function
  const handleUnloadFunction = () => {
    setLoadedFunction(null);
    clearAppliesToResults();
    toast.info('Function unloaded');
  };

  // Handle save as function (create new)
  const handleSaveAsFunction = () => {
    setLoadedFunction(null);
    setCreateDialogOpen(true);
  };

  // Handle update function button click (opens confirmation dialog)
  const handleUpdateFunctionClick = () => {
    if (!loadedFunction) return;
    setUpdateConfirmationOpen(true);
  };

  // Handle create function
  const handleCreateFunction = async (name: string, code: string, description?: string) => {
    try {
      await createCustomFunction(name, code, description);
      toast.success(`Custom function "${name}" created successfully!`);
      setLoadedFunction(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create function');
      throw error;
    }
  };

  // Handle update function (from confirmation dialog)
  const handleUpdateFunction = async (name: string, code: string, description?: string) => {
    if (!loadedFunction) return;
    try {
      await updateCustomFunction(loadedFunction.id, name, code, description);
      toast.success(`Custom function "${name}" updated successfully!`);
      setLoadedFunction(null);
      setUpdateConfirmationOpen(false);
      fetchCustomFunctions(); // Refresh list
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to commit function');
      throw error;
    }
  };

  // Handle delete function
  const handleDeleteFunction = async () => {
    if (!deletingFunctionId) return;
    try {
      await deleteCustomFunction(deletingFunctionId);
      toast.success('Custom function deleted successfully!');
      setDeletingFunctionId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete function');
    }
  };

  // Check if expression is valid for saving
  const canSaveAsFunction = appliesToExpression.trim().length > 0 && 
    (appliesToResults.length > 0 || (!appliesToError && !isTestingAppliesTo));

  // Check if expression has changed from loaded function
  const hasExpressionChanged = useMemo(() => {
    if (!loadedFunction) return false;
    return appliesToExpression.trim() !== loadedFunction.code.trim();
  }, [appliesToExpression, loadedFunction]);

  // Insert function or operator into expression
  const insertItem = useCallback((item: AppliesToFunction | AppliesToOperator) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      const insertText = 'name' in item ? item.syntax : item.symbol;
      setAppliesToExpression(appliesToExpression + insertText);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = appliesToExpression;
    
    const insertText = 'name' in item ? item.syntax : item.symbol;
    
    // Add space before if needed
    const needsSpaceBefore = start > 0 && !/[\s(&|!]/.test(text[start - 1]);
    const prefix = needsSpaceBefore ? ' ' : '';
    
    // Add space after operators if needed
    const needsSpaceAfter = 'symbol' in item && !/[)\s]/.test(text[end]);
    const suffix = needsSpaceAfter ? ' ' : '';
    
    const newText = text.slice(0, start) + prefix + insertText + suffix + text.slice(end);
    setAppliesToExpression(newText);
    
    // Move cursor to appropriate position
    let newCursorPos: number;
    if ('name' in item) {
      const parenPos = insertText.indexOf('(');
      newCursorPos = start + prefix.length + (parenPos > -1 ? parenPos + 1 : insertText.length) + suffix.length;
    } else {
      newCursorPos = start + prefix.length + insertText.length + suffix.length;
    }
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [appliesToExpression, setAppliesToExpression]);

  return (
    <Dialog 
      open={appliesToTesterOpen} 
      onOpenChange={(open) => {
        // Don't close if suggestions are visible - let Escape handle that first
        if (!open && showSuggestions) {
          // Close suggestions first, but don't close the dialog
          setShowSuggestions(false);
          return;
        }
        if (!open) {
          // Clear loaded function when dialog closes
          setLoadedFunction(null);
        }
        setAppliesToTesterOpen(open);
      }}
    >
      <DialogContent className="w-[90vw]! max-w-[90vw]! h-[90vh] flex flex-col gap-0 p-0" showCloseButton>
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Hammer className="size-5" />
            AppliesTo Toolbox
          </DialogTitle>
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
              {/* Operator Toolbar */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">Quick Insert Operators</Label>
                <div className="flex flex-wrap gap-1.5">
                  {/* Comparison Operators */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-1">Comparison:</span>
                    {getOperatorsByCategory('comparison').map((op) => (
                      <Tooltip key={op.symbol}>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => insertItem(op)}
                              className="h-7 px-2 text-xs font-mono"
                              aria-label={op.description}
                            >
                              {op.symbol}
                            </Button>
                          }
                        />
                        <TooltipContent>
                          <div className="space-y-1">
                            <div className="font-medium">{op.symbol}</div>
                            <div className="text-xs">{op.description}</div>
                            <div className="text-xs text-muted-foreground font-mono">{op.example}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                  <Separator orientation="vertical" className="h-6" />
                  {/* Logical Operators */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-1">Logical:</span>
                    {getOperatorsByCategory('logical').map((op) => (
                      <Tooltip key={op.symbol}>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => insertItem(op)}
                              className="h-7 px-2 text-xs font-mono"
                              aria-label={op.description}
                            >
                              {op.symbol}
                            </Button>
                          }
                        />
                        <TooltipContent>
                          <div className="space-y-1">
                            <div className="font-medium">{op.symbol}</div>
                            <div className="text-xs">{op.description}</div>
                            <div className="text-xs text-muted-foreground font-mono">{op.example}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                  <Separator orientation="vertical" className="h-6" />
                  {/* Grouping Operators */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground mr-1">Grouping:</span>
                    {getOperatorsByCategory('grouping').map((op) => (
                      <Tooltip key={op.symbol}>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => insertItem(op)}
                              className="h-7 px-2 text-xs font-mono"
                              aria-label={op.description}
                            >
                              {op.symbol}
                            </Button>
                          }
                        />
                        <TooltipContent>
                          <div className="space-y-1">
                            <div className="font-medium">{op.symbol}</div>
                            <div className="text-xs">{op.description}</div>
                            <div className="text-xs text-muted-foreground font-mono">{op.example}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              </div>

              {/* Expression textarea */}
              <div className="flex-1 flex flex-col gap-2 min-h-0">
                <div className="flex items-center justify-between">
                  <Label htmlFor="expression" className="text-sm font-medium">
                    Expression
                  </Label>
                  {loadedFunction && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Editing: {loadedFunction.name}
                      </Badge>
                      {hasExpressionChanged && (
                        <Badge variant="outline" className="text-xs text-orange-500 border-orange-500">
                          Modified
                        </Badge>
                      )}
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={handleUnloadFunction}
                              className="h-5 w-5"
                              aria-label="Unload function"
                            >
                              <X className="size-3" />
                            </Button>
                          }
                        />
                        <TooltipContent>
                          Unload function
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
                <div className="relative flex-1 min-h-0">
                  <Textarea
                    ref={textareaRef}
                    id="expression"
                    value={appliesToExpression}
                    onChange={handleExpressionChange}
                    onKeyDown={handleKeyDown}
                    onSelect={(e) => {
                      const textarea = e.target as HTMLTextAreaElement;
                      const cursorPos = textarea.selectionStart;
                      const wordContext = extractWordAtCursor(appliesToExpression, cursorPos);
                      setCurrentWord(wordContext.word);
                      setCursorWordStart(wordContext.start);
                    }}
                    onMouseUp={(e) => {
                      const textarea = e.target as HTMLTextAreaElement;
                      const cursorPos = textarea.selectionStart;
                      const wordContext = extractWordAtCursor(appliesToExpression, cursorPos);
                      setCurrentWord(wordContext.word);
                      setCursorWordStart(wordContext.start);
                    }}
                    placeholder='hasCategory("Linux") && isDevice()'
                    className="h-full min-h-[120px] font-mono text-sm resize-none relative z-10"
                  />
                  
                  {/* Autocomplete suggestions dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 bottom-full mb-1 z-50 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto">
                      {suggestions.map((item, index) => {
                        const isFunction = 'name' in item;
                        const displayName = isFunction ? (item as AppliesToFunction).name : (item as AppliesToOperator).symbol;
                        const fullDescription = isFunction 
                          ? (item as AppliesToFunction).description
                          : (item as AppliesToOperator).description;
                        const description = fullDescription.slice(0, 60);
                        
                        // Highlight matched portion
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
                            aria-label={`${isFunction ? 'Function' : 'Operator'}: ${displayName}`}
                          >
                            <Badge 
                              variant={isFunction ? 'default' : 'secondary'} 
                              className="text-xs font-mono flex items-center gap-0"
                            >
                              <span className="font-semibold">{matchedPart}</span>
                              <span className="opacity-70">{remainingPart}</span>
                            </Badge>
                            <span className="text-muted-foreground text-xs truncate flex-1">
                              {description}
                              {fullDescription.length > 60 && '...'}
                            </span>
                            {isFunction && (
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                Function
                              </Badge>
                            )}
                            {!isFunction && (
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {(item as AppliesToOperator).category}
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Test button */}
              <div className="flex items-center justify-end gap-2">
                {loadedFunction ? (
                  <Button
                    variant="default"
                    onClick={handleUpdateFunctionClick}
                    disabled={!hasExpressionChanged || !canSaveAsFunction || !selectedPortalId}
                    className="gap-2 bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    <Upload className="size-4" />
                    Commit Function
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleSaveAsFunction}
                    disabled={!canSaveAsFunction || !selectedPortalId}
                    className="gap-2"
                  >
                    <Save className="size-4" />
                    Save as Function
                  </Button>
                )}
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
                ) : isTestingAppliesTo ? (
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
                ) : appliesToResults.length === 0 ? (
                  <Empty className="h-full border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <CheckCircle2 className="text-green-500" />
                      </EmptyMedia>
                      <EmptyTitle className="text-base">No Matches Found</EmptyTitle>
                      <EmptyDescription>
                        The expression ran successfully but did not match any resources. Try adjusting your criteria.
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
                {typedAllFunctions.length} functions
                {customFunctions.length > 0 && (
                  <span className="ml-1">({customFunctions.length} custom)</span>
                )}
              </Badge>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-4 pb-4">
                {/* Search and Filter */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search functions..."
                      value={appliesToFunctionSearch}
                      onChange={(e) => setAppliesToFunctionSearch(e.target.value)}
                      className="pl-8 h-8"
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label htmlFor="custom-switch" className="text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                      Custom only
                    </Label>
                    <Switch
                      id="custom-switch"
                      checked={showOnlyCustom}
                      onCheckedChange={setShowOnlyCustom}
                    />
                  </div>
                </div>
                
                {/* Loading state */}
                {isLoadingCustomFunctions && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading custom functions...</span>
                  </div>
                )}

                {/* Error state */}
                {customFunctionError && !isLoadingCustomFunctions && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 mb-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="size-4 text-destructive" />
                      <p className="text-sm text-destructive">{customFunctionError}</p>
                    </div>
                  </div>
                )}

                {/* Functions grid - Fixed height container */}
                {!isLoadingCustomFunctions && (
                  <div className="h-48 overflow-auto">
                    {filteredFunctions.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {filteredFunctions.map((func: any) => (
                          <FunctionCard
                            key={`${func.source || 'builtin'}-${func.name}-${func.customId || ''}`}
                            func={func}
                            onInsert={() => insertItem(func)}
                            onLoad={func.source === 'custom' && func.customId ? handleLoadFunction : undefined}
                            onDelete={func.source === 'custom' && func.customId ? setDeletingFunctionId : undefined}
                          />
                        ))}
                      </div>
                    ) : (
                      <Empty className="h-full border-0">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Search className="size-5 text-muted-foreground" />
                          </EmptyMedia>
                          <EmptyTitle className="text-base">No Functions Found</EmptyTitle>
                          <EmptyDescription>
                            {showOnlyCustom
                              ? "No custom functions match your search criteria."
                              : "No functions match your search criteria."}
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>

      {/* Create Function Dialog */}
      <CreateFunctionDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setLoadedFunction(null);
          }
        }}
        onSave={handleCreateFunction}
        initialCode={appliesToExpression}
        isSaving={isCreatingFunction}
      />

      {/* Update Function Confirmation Dialog */}
      {loadedFunction && (
        <UpdateFunctionConfirmationDialog
          open={updateConfirmationOpen}
          onOpenChange={(open) => {
            setUpdateConfirmationOpen(open);
          }}
          onConfirm={handleUpdateFunction}
          function={loadedFunction}
          newCode={appliesToExpression}
          isUpdating={isUpdatingFunction}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deletingFunctionId !== null} onOpenChange={(open) => !open && setDeletingFunctionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <Trash2 className="size-8 text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete Custom Function?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this custom function? This action cannot be undone.
              {deletingFunctionId && (
                <div className="mt-2 font-mono text-sm">
                  {customFunctions.find((cf: CustomAppliesToFunction) => cf.id === deletingFunctionId)?.name}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFunction}
              disabled={isDeletingFunction}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingFunction ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

interface FunctionCardProps {
  func: AppliesToFunction & { source?: 'builtin' | 'custom'; customId?: number };
  onInsert: () => void;
  onLoad?: (func: CustomAppliesToFunction) => void;
  onDelete?: (id: number) => void;
}

function FunctionCard({ func, onInsert, onLoad, onDelete }: FunctionCardProps) {
  const { customFunctions } = useEditorStore();
  const isCustom = func.source === 'custom';
  const customFunction = isCustom && func.customId 
    ? customFunctions.find((cf: CustomAppliesToFunction) => cf.id === func.customId) 
    : null;

  return (
    <div className="group relative w-full text-left p-2 rounded-md border border-border transition-colors">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              onClick={onInsert}
              className="w-full text-left hover:bg-accent/50 rounded-md p-1 -m-1 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1 min-w-0">
                <div className="font-mono text-xs font-medium text-primary truncate flex-1 min-w-0">
                  {func.syntax}
                </div>
                {isCustom && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    Custom
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {func.description.slice(0, 80)}
                {func.description.length > 80 && '...'}
              </div>
            </button>
          }
        />
        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-1">
            <div className="font-mono font-medium">{func.syntax}</div>
            {func.parameters && func.parameters !== 'None' && (
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
            {isCustom && customFunction && (
              <div className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border">
                <div className="font-medium">Code:</div>
                <code className="text-[10px]">{customFunction.code}</code>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
      
      {/* Action buttons for custom functions - always visible */}
      {isCustom && customFunction && (onLoad || onDelete) && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
          {onLoad && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onLoad(customFunction);
              }}
              className="h-7 px-2 text-xs flex-1"
            >
              <Download className="size-3 mr-1" />
              Load
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(customFunction.id);
              }}
              className="h-7 px-2 text-xs flex-1 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3 mr-1" />
              Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

