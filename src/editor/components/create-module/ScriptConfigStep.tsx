/**
 * ScriptConfigStep - Step 3: Configure script language and instance settings
 */
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { LogicModuleType, ScriptLanguage } from '@/shared/types';
import {
  ActiveDiscoveryIcon,
  CollectionIcon,
  BatchCollectionIcon,
} from '../../constants/icons';

// Module types that support Active Discovery (multi-instance)
const AD_SUPPORTED_TYPES: LogicModuleType[] = ['datasource', 'configsource'];

interface ScriptConfigStepProps {
  moduleType: LogicModuleType;
  collectionLanguage: ScriptLanguage;
  hasMultiInstances: boolean;
  useBatchScript: boolean;
  adLanguage: ScriptLanguage;
  onCollectionLanguageChange: (language: ScriptLanguage) => void;
  onHasMultiInstancesChange: (value: boolean) => void;
  onUseBatchScriptChange: (value: boolean) => void;
  onAdLanguageChange: (language: ScriptLanguage) => void;
}

interface LanguageOptionProps {
  language: ScriptLanguage;
  selected: boolean;
  onSelect: () => void;
  label: string;
}

function LanguageOption({ language, selected, onSelect, label }: LanguageOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex-1 rounded-lg border px-4 py-3 text-center transition-all',
        selected
          ? 'border-primary bg-primary/5 text-foreground'
          : 'border-border bg-card/60 text-muted-foreground hover:border-primary/30 hover:bg-card/80'
      )}
    >
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {language === 'groovy' ? '.groovy' : '.ps1'}
      </p>
    </button>
  );
}

export function ScriptConfigStep({
  moduleType,
  collectionLanguage,
  hasMultiInstances,
  useBatchScript,
  adLanguage,
  onCollectionLanguageChange,
  onHasMultiInstancesChange,
  onUseBatchScriptChange,
  onAdLanguageChange,
}: ScriptConfigStepProps) {
  const supportsAD = AD_SUPPORTED_TYPES.includes(moduleType);

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* Collection Script Language */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <CollectionIcon className="size-4" />
          Script Language
        </Label>
        <div className="flex gap-3">
          <LanguageOption
            language="groovy"
            label="Groovy"
            selected={collectionLanguage === 'groovy'}
            onSelect={() => onCollectionLanguageChange('groovy')}
          />
          <LanguageOption
            language="powershell"
            label="PowerShell"
            selected={collectionLanguage === 'powershell'}
            onSelect={() => onCollectionLanguageChange('powershell')}
          />
        </div>
      </div>

      {/* Multi-Instance Toggle - only for AD-supported module types */}
      {supportsAD && (
        <div className="
          flex items-center justify-between rounded-lg border border-border bg-card/60 p-4
        ">
          <div className="space-y-0.5">
            <Label htmlFor="multi-instance" className="flex items-center gap-2 text-sm font-medium">
              <ActiveDiscoveryIcon className="size-4" />
              Multi-Instance (Active Discovery)
            </Label>
            <p className="text-xs text-muted-foreground">
              Enable if this module monitors multiple instances per device
            </p>
          </div>
          <Switch
            id="multi-instance"
            checked={hasMultiInstances}
            onCheckedChange={(checked) => {
              onHasMultiInstancesChange(checked);
              // Reset batch script when disabling multi-instance
              if (!checked) {
                onUseBatchScriptChange(false);
              }
            }}
          />
        </div>
      )}

      {/* Multi-Instance Options */}
      {hasMultiInstances && (
        <div className="space-y-4 rounded-lg border border-border/50 bg-muted/5 p-4">
          {/* Batch Script Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label
                htmlFor="batch-script"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <BatchCollectionIcon className="size-4" />
                Batch Collection
              </Label>
              <p className="text-xs text-muted-foreground">
                Collect all instances in a single script execution
              </p>
            </div>
            <Switch
              id="batch-script"
              checked={useBatchScript}
              onCheckedChange={onUseBatchScriptChange}
            />
          </div>

          {/* AD Script Language */}
          <div className="space-y-3 pt-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <ActiveDiscoveryIcon className="size-4" />
              Active Discovery Script Language
            </Label>
            <div className="flex gap-3">
              <LanguageOption
                language="groovy"
                label="Groovy"
                selected={adLanguage === 'groovy'}
                onSelect={() => onAdLanguageChange('groovy')}
              />
              <LanguageOption
                language="powershell"
                label="PowerShell"
                selected={adLanguage === 'powershell'}
                onSelect={() => onAdLanguageChange('powershell')}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
