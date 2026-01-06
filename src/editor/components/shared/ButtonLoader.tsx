/**
 * Standardized button loading spinner.
 * 
 * Use this component inside buttons to show loading state.
 * For full-panel/section loading, use LoadingState instead.
 * 
 * @example
 * ```tsx
 * <Button disabled={isLoading}>
 *   {isLoading && <ButtonLoader />}
 *   {isLoading ? 'Saving...' : 'Save'}
 * </Button>
 * ```
 */

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ButtonLoaderProps {
  /** Additional CSS classes */
  className?: string;
  /** Size variant for the spinner */
  size?: 'sm' | 'default' | 'lg';
}

const sizeClasses = {
  sm: 'size-3',
  default: 'size-4',
  lg: 'size-5',
};

export function ButtonLoader({ className, size = 'default' }: ButtonLoaderProps) {
  return (
    <Loader2 
      className={cn(
        sizeClasses[size],
        'animate-spin',
        className
      )} 
    />
  );
}

