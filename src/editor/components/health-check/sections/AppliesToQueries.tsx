import { useState } from 'react';
import { Copy, Check, Filter, Play } from 'lucide-react';
import { SectionCard } from '../SectionCard';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { InfoIcon } from '../../../constants/icons';
import { clipboardToasts } from '../../../utils/toast-utils';
import { useEditorStore } from '../../../stores/editor-store';
import type { AppliesToQuery } from '../types';

interface AppliesToQueriesProps {
  queries: AppliesToQuery[];
}

export function AppliesToQueries({ queries }: AppliesToQueriesProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const { 
    setAppliesToExpression, 
    setAppliesToTesterOpen,
    clearAppliesToResults,
    selectedPortalId,
  } = useEditorStore();

  const copyToClipboard = async (query: string, index: number) => {
    try {
      await navigator.clipboard.writeText(query);
      setCopiedIndex(index);
      clipboardToasts.copied('query');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      clipboardToasts.copyFailed('query');
    }
  };

  const handleTestQuery = (query: string) => {
    // Clear previous results and set the expression
    clearAppliesToResults();
    setAppliesToExpression(query);
    // Open the AppliesTo Tester dialog
    setAppliesToTesterOpen(true);
  };

  if (!queries || queries.length === 0) {
    return (
      <SectionCard title="Helpful AppliesTo Queries" icon={<Filter className="size-4" />}>
        <Empty className="border-none bg-transparent py-6 shadow-none">
          <EmptyMedia variant="icon" className="mx-auto mb-3 bg-muted/50">
            <InfoIcon className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm font-medium">No queries available</EmptyTitle>
            <EmptyDescription className="text-xs">
              AppliesTo queries will appear here when available.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </SectionCard>
    );
  }

  return (
    <SectionCard 
      title="Helpful AppliesTo Queries" 
      icon={<Filter className="size-4" />}
      collapsible
    >
      <div className="space-y-3">
        {queries.map((item, index) => (
          <div 
            key={index} 
            className="
              rounded-lg border border-border/50 bg-muted/30 p-3
              backdrop-blur-sm
            "
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{item.label}</p>
              <div className="flex shrink-0 items-center gap-1">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2"
                        onClick={() => handleTestQuery(item.query)}
                        disabled={!selectedPortalId}
                      >
                        <Play className="size-3.5" />
                        <span className="text-xs">Test</span>
                      </Button>
                    }
                  />
                  <TooltipContent>
                    {selectedPortalId 
                      ? 'Test this query in the AppliesTo Toolbox' 
                      : 'Connect to a portal to test queries'}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => copyToClipboard(item.query, index)}
                      >
                        {copiedIndex === index ? (
                          <Check className="size-3.5 text-teal-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </Button>
                    }
                  />
                  <TooltipContent>Copy query</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <code className="
              block font-mono text-xs break-all text-muted-foreground
            ">
              {item.query}
            </code>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
