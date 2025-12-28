import { XCircle, AlertTriangle } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  description?: string;
  icon?: 'error' | 'warning';
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({ 
  title = 'Something went wrong',
  description,
  icon = 'error',
  onRetry,
  retryLabel = 'Retry',
  className,
}: ErrorStateProps) {
  const Icon = icon === 'error' ? XCircle : AlertTriangle;
  const iconColor = icon === 'error' ? 'text-destructive' : 'text-amber-500';

  return (
    <Empty className={cn('h-full border-0', className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon className={cn('size-5', iconColor)} />
        </EmptyMedia>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-4"
          >
            {retryLabel}
          </Button>
        )}
      </EmptyHeader>
    </Empty>
  );
}

