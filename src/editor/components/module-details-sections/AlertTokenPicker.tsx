import { useState, useMemo } from 'react';
import { Hash, Search, Star, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { LogicModuleType } from '@/shared/types';
import {
  getTokensForModuleType,
  getFrequentlyUsedTokens,
  getTokensByCategory,
  ALERT_TOKEN_CATEGORY_LABELS,
  ALERT_TOKEN_CATEGORY_ORDER,
  type AlertToken,
} from '../../constants/alert-tokens';

interface AlertTokenPickerProps {
  /** Callback when a token is selected */
  onInsert: (token: string) => void;
  /** Module type to filter available tokens */
  moduleType: LogicModuleType;
  /** Optional class name for the trigger button */
  className?: string;
}

/**
 * A popover component for browsing and inserting alert tokens.
 * Displays frequently used tokens at the top, followed by categorized sections.
 */
export function AlertTokenPicker({ onInsert, moduleType, className }: AlertTokenPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Get all tokens for this module type
  const allTokens = useMemo(() => getTokensForModuleType(moduleType), [moduleType]);
  const frequentlyUsed = useMemo(() => getFrequentlyUsedTokens(moduleType), [moduleType]);
  const tokensByCategory = useMemo(() => getTokensByCategory(moduleType), [moduleType]);

  // Filter tokens by search query
  const filteredTokens = useMemo(() => {
    if (!search.trim()) return null;
    const query = search.toLowerCase();
    return allTokens.filter(
      (token) =>
        token.token.toLowerCase().includes(query) ||
        token.description.toLowerCase().includes(query)
    );
  }, [search, allTokens]);

  // Filter frequently used by search
  const filteredFrequentlyUsed = useMemo(() => {
    if (!search.trim()) return frequentlyUsed;
    const query = search.toLowerCase();
    return frequentlyUsed.filter(
      (token) =>
        token.token.toLowerCase().includes(query) ||
        token.description.toLowerCase().includes(query)
    );
  }, [search, frequentlyUsed]);

  const handleSelectToken = (token: AlertToken) => {
    onInsert(`##${token.token}##`);
    setOpen(false);
    setSearch('');
  };

  const renderTokenItem = (token: AlertToken, showCategory = false) => (
    <button
      key={token.token}
      type="button"
      onClick={() => handleSelectToken(token)}
      className={cn(
        'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left',
        'transition-colors hover:bg-accent hover:text-accent-foreground',
        'focus:bg-accent focus:text-accent-foreground focus:outline-none'
      )}
    >
      <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-primary">
        ##{token.token}##
      </code>
      <span className="min-w-0 flex-1 text-xs text-muted-foreground line-clamp-2">
        {token.description}
        {showCategory && (
          <span className="ml-1 text-[10px] opacity-60">
            ({ALERT_TOKEN_CATEGORY_LABELS[token.category]})
          </span>
        )}
      </span>
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn('h-6 gap-1 px-2 text-xs text-muted-foreground', className)}
                >
                  <Hash className="size-3" />
                  Insert Token
                </Button>
              }
            />
          }
        />
        <TooltipContent>Insert an alert message token</TooltipContent>
      </Tooltip>

      <PopoverContent
        align="end"
        side="bottom"
        className="w-[400px] p-0"
      >
        {/* Search Header */}
        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search tokens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="h-[350px]">
          <div className="p-2">
            {/* Search Results Mode */}
            {filteredTokens ? (
              filteredTokens.length > 0 ? (
                <div className="space-y-1">
                  <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Search Results ({filteredTokens.length})
                  </div>
                  {filteredTokens.map((token) => renderTokenItem(token, true))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No tokens match "{search}"
                </div>
              )
            ) : (
              <>
                {/* Frequently Used Section */}
                {filteredFrequentlyUsed.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      Frequently Used
                    </div>
                    <div className="space-y-0.5">
                      {filteredFrequentlyUsed.map((token) => renderTokenItem(token))}
                    </div>
                  </div>
                )}

                {/* Categorized Sections */}
                <Accordion className="space-y-1">
                  {ALERT_TOKEN_CATEGORY_ORDER.map((category) => {
                    const tokens = tokensByCategory.get(category);
                    if (!tokens || tokens.length === 0) return null;

                    return (
                      <AccordionItem
                        key={category}
                        className="border-none"
                      >
                        <AccordionTrigger className="px-2 py-1.5 text-xs font-medium hover:no-underline [&[data-state=open]>svg]:rotate-90">
                          <div className="flex items-center gap-1.5">
                            <ChevronRight className="size-3 transition-transform" />
                            {ALERT_TOKEN_CATEGORY_LABELS[category]}
                            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                              ({tokens.length})
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-2 pt-0">
                          <div className="space-y-0.5 pl-2">
                            {tokens.map((token) => renderTokenItem(token))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer hint */}
        <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
          Click a token to insert it at cursor position
        </div>
      </PopoverContent>
    </Popover>
  );
}
