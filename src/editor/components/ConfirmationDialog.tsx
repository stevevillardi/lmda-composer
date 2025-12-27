import { type ReactNode } from 'react';
import { AlertTriangle, type LucideIcon } from 'lucide-react';
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

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: 'default' | 'warning' | 'destructive';
  icon?: LucideIcon;
}

const variantStyles = {
  default: {
    iconBg: 'bg-muted',
    iconColor: 'text-foreground',
    buttonClass: '',
  },
  warning: {
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    buttonClass: 'bg-amber-600 hover:bg-amber-500',
  },
  destructive: {
    iconBg: 'bg-destructive/10',
    iconColor: 'text-destructive',
    buttonClass: 'bg-destructive hover:bg-destructive/90',
  },
};

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
  icon: Icon = AlertTriangle,
}: ConfirmationDialogProps) {
  const styles = variantStyles[variant];

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className={styles.iconBg}>
            <Icon className={cn('size-8', styles.iconColor)} />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={styles.buttonClass}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

