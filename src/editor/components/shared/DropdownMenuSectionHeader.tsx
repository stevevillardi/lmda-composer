import { Separator } from '@/components/ui/separator';

interface DropdownMenuSectionHeaderProps {
  children: React.ReactNode;
}

/**
 * A styled section header for dropdown menus.
 * Displays centered text with separators on each side.
 * 
 * @example
 * ```tsx
 * <DropdownMenuSectionHeader>Portal Actions</DropdownMenuSectionHeader>
 * ```
 */
export function DropdownMenuSectionHeader({ children }: DropdownMenuSectionHeaderProps) {
  return (
    <div className="relative flex items-center gap-2 my-2">
      <Separator className="flex-1" />
      <span className="shrink-0 px-2 text-xs text-muted-foreground select-none">
        {children}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}

