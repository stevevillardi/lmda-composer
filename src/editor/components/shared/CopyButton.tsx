import { useState } from 'react';
import { Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SIZES } from '../../constants/sizes';

interface CopyButtonProps {
  text: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'outline';
  className?: string;
  tooltip?: string;
  onCopy?: () => void;
}

export function CopyButton({ 
  text, 
  size = 'md',
  variant = 'ghost',
  className,
  tooltip = 'Copy to clipboard',
  onCopy,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const iconSize = size === 'sm' ? SIZES.ICON_SMALL : SIZES.ICON_MEDIUM;
  const buttonSize = size === 'sm' ? 'icon-xs' : 'icon-sm';

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={variant}
            size={buttonSize}
            onClick={handleCopy}
            className={className}
            aria-label={tooltip}
          >
            {copied ? (
              <CheckCircle2 className={`${iconSize} text-green-500`} />
            ) : (
              <Copy className={iconSize} />
            )}
          </Button>
        }
      />
      <TooltipContent>{copied ? 'Copied!' : tooltip}</TooltipContent>
    </Tooltip>
  );
}

