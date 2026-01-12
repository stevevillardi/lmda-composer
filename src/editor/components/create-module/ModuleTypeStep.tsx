/**
 * ModuleTypeStep - Step 1: Select the type of module to create
 */
import { cn } from '@/lib/utils';
import type { LogicModuleType } from '@/shared/types';
import { LOGIC_MODULE_TYPES } from '../../constants/logic-module-types';

interface ModuleTypeStepProps {
  value: LogicModuleType;
  onChange: (type: LogicModuleType) => void;
}

// Only DataSource is enabled for now
const ENABLED_TYPES: LogicModuleType[] = ['datasource'];

export function ModuleTypeStep({ value, onChange }: ModuleTypeStepProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {LOGIC_MODULE_TYPES.map((type) => {
          const Icon = type.icon;
          const isEnabled = ENABLED_TYPES.includes(type.value);
          const isSelected = value === type.value;

          return (
            <button
              key={type.value}
              type="button"
              onClick={() => isEnabled && onChange(type.value)}
              disabled={!isEnabled}
              className={cn(
                'group relative flex flex-col items-center gap-3 rounded-xl border p-5 text-center transition-all',
                isEnabled
                  ? isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card/60 hover:border-primary/30 hover:bg-card/80'
                  : 'cursor-not-allowed border-border/50 bg-muted/20 opacity-50'
              )}
            >
              <div
                className={cn(
                  'flex size-12 items-center justify-center rounded-full transition-colors',
                  isSelected
                    ? 'bg-primary/10'
                    : isEnabled
                      ? 'bg-muted/50 group-hover:bg-muted'
                      : 'bg-muted/30'
                )}
              >
                <Icon
                  className={cn(
                    'size-6',
                    isSelected
                      ? 'text-primary'
                      : isEnabled
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/50'
                  )}
                />
              </div>
              <div>
                <p
                  className={cn(
                    'text-sm font-medium',
                    isSelected
                      ? 'text-foreground'
                      : isEnabled
                        ? 'text-foreground/90'
                        : 'text-muted-foreground'
                  )}
                >
                  {type.label}
                </p>
                {!isEnabled && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Coming Soon
                  </p>
                )}
              </div>
              {isSelected && (
                <div className="
                  absolute top-2 right-2 flex size-5 items-center justify-center
                  rounded-full bg-primary text-primary-foreground
                ">
                  <svg
                    className="size-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
