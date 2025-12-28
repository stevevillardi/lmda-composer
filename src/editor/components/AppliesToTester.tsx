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
  Edit2,
  MoreVertical,
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
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { APPLIES_TO_OPERATORS, getOperatorsByCategory, type AppliesToOperator } from '../data/applies-to-operators';
import { CreateFunctionDialog } from './AppliesToTester/CreateFunctionDialog';
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
  const [editingFunction, setEditingFunction] = useState<CustomAppliesToFunction | null>(null);
  const [deletingFunctionId, setDeletingFunctionId] = useState<number | null>(null);

  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [cursorWordStart, setCursorWordStart] = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const [inlineSuggestion, setInlineSuggestion] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ top: 0, left: 0 });
  const textareaContainerRef = useRef<HTMLDivElement>(null);

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

  // Filter functions based on search
  const filteredFunctions = useMemo(() => {
    if (!appliesToFunctionSearch.trim()) return typedAllFunctions;
    const query = appliesToFunctionSearch.toLowerCase();
    return typedAllFunctions.filter(
      (f: any) => f.name.toLowerCase().includes(query) || 
           f.description.toLowerCase().includes(query)
    );
  }, [appliesToFunctionSearch, typedAllFunctions]);

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
    
    // Add operator matches
    const operatorMatches = APPLIES_TO_OPERATORS
      .filter(op => {
        const symbol = op.symbol.toLowerCase();
        return symbol.startsWith(word) || 
               op.alternatives?.some(alt => alt.toLowerCase().startsWith(word));
      })
      .slice(0, 3);
    results.push(...operatorMatches);
    
    return results;
  }, [currentWord, typedAllFunctions]);


  // Calculate cursor position for inline autocomplete
  const updateCursorPosition = useCallback((textarea: HTMLTextAreaElement) => {
    if (!textareaContainerRef.current || !textarea) return;
    
    const containerRect = textareaContainerRef.current.getBoundingClientRect();
    const textareaRect = textarea.getBoundingClientRect();
    
    // Get computed styles
    const computedStyle = window.getComputedStyle(textarea);
    const font = computedStyle.font;
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
    const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.5;
    
    // Create a temporary span to measure text
    const span = document.createElement('span');
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre-wrap';
    span.style.font = font;
    span.style.padding = '0';
    span.style.border = '0';
    span.style.width = `${textarea.offsetWidth - paddingLeft * 2}px`;
    span.style.wordWrap = 'break-word';
    
    const textBeforeCursor = textarea.value.substring(0, textarea.selectionStart);
    
    // Handle newlines - count them to calculate vertical position
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];
    const lineNumber = lines.length - 1;
    
    // Measure the current line width
    span.textContent = currentLine;
    document.body.appendChild(span);
    const spanWidth = span.offsetWidth;
    document.body.removeChild(span);
    
    // Calculate position relative to container (not textarea)
    const left = (textareaRect.left - containerRect.left) + paddingLeft + spanWidth;
    const top = (textareaRect.top - containerRect.top) + paddingTop + (lineNumber * lineHeight);
    
    setCursorPosition({ left, top });
  }, []);

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
      
      // Add operator matches
      const operatorMatches = APPLIES_TO_OPERATORS
        .filter(op => {
          const symbol = op.symbol.toLowerCase();
          return symbol.startsWith(word) || 
                 op.alternatives?.some(alt => alt.toLowerCase().startsWith(word));
        })
        .slice(0, 3);
      currentSuggestions.push(...operatorMatches);
    }
    
    setShowSuggestions(currentSuggestions.length > 0);
    setSuggestionIndex(0);
    
    // Set inline suggestion (first match) - use same logic as suggestions memo
    if (wordContext.word.length >= 1) {
      const word = wordContext.word.toLowerCase();
      // Use the same matching logic as suggestions memo
      const functionMatch = typedAllFunctions.find((f: any) => f.name.toLowerCase().startsWith(word));
      const operatorMatch = APPLIES_TO_OPERATORS.find(op => 
        op.symbol.toLowerCase().startsWith(word) ||
        op.alternatives?.some(alt => alt.toLowerCase().startsWith(word))
      );
      
      const match = functionMatch || operatorMatch;
      if (match) {
        if ('name' in match) {
          const remaining = match.name.slice(wordContext.word.length);
          setInlineSuggestion(remaining);
        } else {
          const remaining = match.symbol.slice(wordContext.word.length);
          setInlineSuggestion(remaining);
        }
      } else {
        setInlineSuggestion(null);
      }
    } else {
      setInlineSuggestion(null);
    }
  };

  // Handle selecting a suggestion (function or operator)
  const selectSuggestion = useCallback((item: AppliesToFunction | AppliesToOperator) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const text = appliesToExpression;
    const cursorPos = textarea.selectionStart;
    
    // Build the insertion text
    let insertText: string;
    if ('name' in item) {
      // Function
      const func = item as AppliesToFunction;
      insertText = func.syntax.includes('()') ? func.syntax : func.name;
    } else {
      // Operator
      const op = item as AppliesToOperator;
      insertText = op.symbol;
    }
    
    // Replace the current word with the selected item
    const newText = text.slice(0, cursorWordStart) + insertText + text.slice(cursorPos);
    setAppliesToExpression(newText);
    
    // Move cursor to appropriate position
    let newCursorPos: number;
    if ('name' in item) {
      const parenPos = insertText.indexOf('(');
      newCursorPos = cursorWordStart + (parenPos > -1 ? parenPos + 1 : insertText.length);
    } else {
      newCursorPos = cursorWordStart + insertText.length;
    }
    
    setShowSuggestions(false);
    setCurrentWord('');
    setInlineSuggestion(null);
    
    // Focus and set cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      updateCursorPosition(textarea);
    }, 0);
  }, [appliesToExpression, cursorWordStart, setAppliesToExpression, updateCursorPosition]);

  // Handle keyboard navigation in suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Tab for inline autocomplete
    if (e.key === 'Tab' && inlineSuggestion && !showSuggestions) {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const cursorPos = textarea.selectionStart;
        const newText = appliesToExpression.slice(0, cursorPos) + inlineSuggestion + appliesToExpression.slice(cursorPos);
        setAppliesToExpression(newText);
        setInlineSuggestion(null);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(cursorPos + inlineSuggestion.length, cursorPos + inlineSuggestion.length);
          updateCursorPosition(textarea);
        }, 0);
      }
      return;
    }

    if (!showSuggestions || suggestions.length === 0) {
      // Allow Enter to submit if not showing suggestions
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        testAppliesTo();
      }
      // Allow regular Tab to work normally if no inline suggestion
      if (e.key === 'Tab' && !inlineSuggestion) {
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

  // Update cursor position on mount and when expression changes
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        updateCursorPosition(textarea);
      });
    }
  }, [appliesToExpression, updateCursorPosition]);

  // Update cursor position when inline suggestion changes
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && inlineSuggestion) {
      requestAnimationFrame(() => {
        updateCursorPosition(textarea);
      });
    }
  }, [inlineSuggestion, updateCursorPosition]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setInlineSuggestion(null);
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

  // Handle save as function
  const handleSaveAsFunction = () => {
    setEditingFunction(null);
    setCreateDialogOpen(true);
  };

  // Handle create function
  const handleCreateFunction = async (name: string, code: string, description?: string) => {
    try {
      await createCustomFunction(name, code, description);
      toast.success(`Custom function "${name}" created successfully!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create function');
      throw error;
    }
  };

  // Handle edit function
  const handleEditFunction = (func: CustomAppliesToFunction) => {
    setEditingFunction(func);
    setCreateDialogOpen(true);
  };

  // Handle update function
  const handleUpdateFunction = async (name: string, code: string, description?: string) => {
    if (!editingFunction) return;
    try {
      await updateCustomFunction(editingFunction.id, name, code, description);
      toast.success(`Custom function "${name}" updated successfully!`);
      setEditingFunction(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update function');
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
      updateCursorPosition(textarea);
    }, 0);
  }, [appliesToExpression, setAppliesToExpression, updateCursorPosition]);

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
                <Label htmlFor="expression" className="text-sm font-medium">
                  Expression
                  {inlineSuggestion && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      (Press <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px]">Tab</kbd> to complete)
                    </span>
                  )}
                </Label>
                <div ref={textareaContainerRef} className="relative flex-1 min-h-0">
                  <Textarea
                    ref={textareaRef}
                    id="expression"
                    value={appliesToExpression}
                    onChange={handleExpressionChange}
                    onKeyDown={handleKeyDown}
                    onSelect={(e) => {
                      const textarea = e.target as HTMLTextAreaElement;
                      updateCursorPosition(textarea);
                      const cursorPos = textarea.selectionStart;
                      const wordContext = extractWordAtCursor(appliesToExpression, cursorPos);
                      setCurrentWord(wordContext.word);
                      setCursorWordStart(wordContext.start);
                      
                      // Update inline suggestion
                      if (wordContext.word.length >= 1) {
                        const word = wordContext.word.toLowerCase();
                        const functionMatch = typedAllFunctions.find((f: any) => f.name.toLowerCase().startsWith(word));
                        const operatorMatch = APPLIES_TO_OPERATORS.find(op => 
                          op.symbol.toLowerCase().startsWith(word) ||
                          op.alternatives?.some(alt => alt.toLowerCase().startsWith(word))
                        );
                        
                        const match = functionMatch || operatorMatch;
                        if (match) {
                          if ('name' in match) {
                            const remaining = match.name.slice(wordContext.word.length);
                            setInlineSuggestion(remaining);
                          } else {
                            const remaining = match.symbol.slice(wordContext.word.length);
                            setInlineSuggestion(remaining);
                          }
                        } else {
                          setInlineSuggestion(null);
                        }
                      } else {
                        setInlineSuggestion(null);
                      }
                    }}
                    onMouseUp={(e) => {
                      const textarea = e.target as HTMLTextAreaElement;
                      updateCursorPosition(textarea);
                      const cursorPos = textarea.selectionStart;
                      const wordContext = extractWordAtCursor(appliesToExpression, cursorPos);
                      setCurrentWord(wordContext.word);
                      setCursorWordStart(wordContext.start);
                      
                      // Update inline suggestion
                      if (wordContext.word.length >= 1) {
                        const word = wordContext.word.toLowerCase();
                        const functionMatch = typedAllFunctions.find((f: any) => f.name.toLowerCase().startsWith(word));
                        const operatorMatch = APPLIES_TO_OPERATORS.find(op => 
                          op.symbol.toLowerCase().startsWith(word) ||
                          op.alternatives?.some(alt => alt.toLowerCase().startsWith(word))
                        );
                        
                        const match = functionMatch || operatorMatch;
                        if (match) {
                          if ('name' in match) {
                            const remaining = match.name.slice(wordContext.word.length);
                            setInlineSuggestion(remaining);
                          } else {
                            const remaining = match.symbol.slice(wordContext.word.length);
                            setInlineSuggestion(remaining);
                          }
                        } else {
                          setInlineSuggestion(null);
                        }
                      } else {
                        setInlineSuggestion(null);
                      }
                    }}
                    placeholder='hasCategory("Linux") && isDevice()'
                    className="h-full min-h-[120px] font-mono text-sm resize-none relative z-10"
                  />
                  
                  {/* Inline autocomplete overlay */}
                  {inlineSuggestion && (
                    <div
                      className="absolute pointer-events-none z-30 font-mono text-sm"
                      style={{
                        left: `${Math.max(cursorPosition.left, 0)}px`,
                        top: `${cursorPosition.top}px`,
                        color: 'hsl(var(--muted-foreground) / 0.7)',
                        fontStyle: 'italic',
                        lineHeight: 'inherit',
                      }}
                    >
                      {inlineSuggestion}
                    </div>
                  )}
                  
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
                <Button
                  variant="outline"
                  onClick={handleSaveAsFunction}
                  disabled={!canSaveAsFunction || !selectedPortalId}
                  className="gap-2"
                >
                  <Save className="size-4" />
                  Save as Function
                </Button>
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

                {/* Functions grid */}
                {!isLoadingCustomFunctions && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-auto">
                      {filteredFunctions.map((func: any) => (
                        <FunctionCard
                          key={`${func.source || 'builtin'}-${func.name}-${func.customId || ''}`}
                          func={func}
                          onInsert={() => insertItem(func)}
                          onEdit={func.source === 'custom' && func.customId ? handleEditFunction : undefined}
                          onDelete={func.source === 'custom' && func.customId ? setDeletingFunctionId : undefined}
                        />
                      ))}
                    </div>
                    
                    {filteredFunctions.length === 0 && (
                      <div className="text-center text-sm text-muted-foreground py-4">
                        No functions match your search
                      </div>
                    )}
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>

      {/* Create/Edit Function Dialog */}
      <CreateFunctionDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setEditingFunction(null);
          }
        }}
        onSave={editingFunction ? handleUpdateFunction : handleCreateFunction}
        editingFunction={editingFunction}
        initialCode={appliesToExpression}
        isSaving={isCreatingFunction || isUpdatingFunction}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deletingFunctionId !== null} onOpenChange={(open) => !open && setDeletingFunctionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
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
  onEdit?: (func: CustomAppliesToFunction) => void;
  onDelete?: (id: number) => void;
}

function FunctionCard({ func, onInsert, onEdit, onDelete }: FunctionCardProps) {
  const { customFunctions } = useEditorStore();
  const isCustom = func.source === 'custom';
  const customFunction = isCustom && func.customId 
    ? customFunctions.find((cf: CustomAppliesToFunction) => cf.id === func.customId) 
    : null;

  return (
    <div className="group relative w-full text-left p-2 rounded-md border border-border hover:bg-accent/50 transition-colors">
      {/* Action menu for custom functions - positioned first so it's on top */}
      {isCustom && customFunction && (onEdit || onDelete) && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="h-6 w-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="size-3" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(customFunction)}>
                  <Edit2 className="size-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {onEdit && onDelete && <DropdownMenuSeparator />}
              {onDelete && (
                <DropdownMenuItem 
                  onClick={() => onDelete(customFunction.id)}
                  className="text-destructive"
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              onClick={onInsert}
              className="w-full text-left pr-8"
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
    </div>
  );
}

