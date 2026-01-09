import { Loader2 } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function LoadingState({ 
  title = 'Loading...',
  description = 'Please wait',
  className,
}: LoadingStateProps) {
  return (
    <Empty className={cn('flex h-full items-center justify-center border-0', className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Loader2 className="size-5 animate-spin" />
        </EmptyMedia>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

