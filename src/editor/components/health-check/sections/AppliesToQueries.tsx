import { useState } from 'react';
import { Copy, Check, Filter, Info } from 'lucide-react';
import { SectionCard } from '../SectionCard';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { AppliesToQuery } from '../types';

interface AppliesToQueriesProps {
  queries: AppliesToQuery[];
}

export function AppliesToQueries({ queries }: AppliesToQueriesProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = async (query: string, index: number) => {
    try {
      await navigator.clipboard.writeText(query);
      setCopiedIndex(index);
      toast.success('Query copied to clipboard');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast.error('Failed to copy query');
    }
  };

  if (!queries || queries.length === 0) {
    return (
      <SectionCard title="Helpful AppliesTo Queries" icon={<Filter className="
        size-4
      " />}>
        <div className="
          flex items-center justify-center py-8 text-muted-foreground
          select-none
        ">
          <Info className="mr-2 size-5 opacity-50" />
          <span className="text-sm">No queries available</span>
        </div>
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
            className="rounded-lg border border-border/50 bg-muted/50 p-3"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{item.label}</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2"
                onClick={() => copyToClipboard(item.query, index)}
              >
                {copiedIndex === index ? (
                  <Check className="size-3.5 text-teal-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
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

