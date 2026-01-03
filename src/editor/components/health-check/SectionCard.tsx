import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
  headerAction?: ReactNode;
}

export function SectionCard({
  title,
  icon,
  children,
  collapsible = false,
  defaultCollapsed = false,
  className,
  headerAction,
}: SectionCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {collapsible && (
              <Button
                variant="ghost"
                size="sm"
                className="size-6 p-0"
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                {isCollapsed ? (
                  <ChevronRight className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </Button>
            )}
            {icon && <span className="text-muted-foreground select-none">{icon}</span>}
            <CardTitle className="text-base select-none">{title}</CardTitle>
          </div>
          {headerAction}
        </div>
      </CardHeader>
      {!isCollapsed && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

