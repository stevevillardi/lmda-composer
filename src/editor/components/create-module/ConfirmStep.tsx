/**
 * ConfirmStep - Step 4: Review configuration and confirm creation
 */
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info, AlertTriangle } from 'lucide-react';
import type { LogicModuleType, ScriptLanguage } from '@/shared/types';
import { LOGIC_MODULE_TYPES } from '../../constants/logic-module-types';
import {
  ActiveDiscoveryIcon,
  CollectionIcon,
  BatchCollectionIcon,
} from '../../constants/icons';

interface ConfirmStepProps {
  moduleType: LogicModuleType;
  name: string;
  displayName: string;
  collectionLanguage: ScriptLanguage;
  hasMultiInstances: boolean;
  useBatchScript: boolean;
  adLanguage?: ScriptLanguage;
}

interface SummaryRowProps {
  label: string;
  value: React.ReactNode;
}

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

// Module types that support Active Discovery
const AD_SUPPORTED_TYPES: LogicModuleType[] = ['datasource', 'configsource'];

// Module types that support display name
const DISPLAY_NAME_SUPPORTED_TYPES: LogicModuleType[] = ['datasource', 'configsource'];

// Get collect interval description by module type
function getCollectIntervalDescription(moduleType: LogicModuleType): string {
  switch (moduleType) {
    case 'datasource':
      return '5 minutes';
    case 'configsource':
    case 'topologysource':
      return '1 hour';
    case 'propertysource':
      return 'On device discovery';
    default:
      return '5 minutes';
  }
}

export function ConfirmStep({
  moduleType,
  name,
  displayName,
  collectionLanguage,
  hasMultiInstances,
  useBatchScript,
  adLanguage,
}: ConfirmStepProps) {
  const moduleTypeInfo = LOGIC_MODULE_TYPES.find((t) => t.value === moduleType);
  const ModuleIcon = moduleTypeInfo?.icon;
  const supportsAD = AD_SUPPORTED_TYPES.includes(moduleType);
  const supportsDisplayName = DISPLAY_NAME_SUPPORTED_TYPES.includes(moduleType);

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* Configuration Summary */}
      <div className="rounded-lg border border-border bg-card/60 p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">Configuration Summary</h3>
        <div className="divide-y divide-border">
          <SummaryRow
            label="Module Type"
            value={
              <span className="flex items-center gap-1.5">
                {ModuleIcon && <ModuleIcon className="size-4" />}
                {moduleTypeInfo?.label}
              </span>
            }
          />
          <SummaryRow label="Name" value={name} />
          {supportsDisplayName && (
            <SummaryRow
              label="Display Name"
              value={displayName || <span className="text-muted-foreground">Same as name</span>}
            />
          )}
          <SummaryRow
            label="Script Language"
            value={
              <span className="flex items-center gap-1.5">
                {useBatchScript ? (
                  <BatchCollectionIcon className="size-4" />
                ) : (
                  <CollectionIcon className="size-4" />
                )}
                {collectionLanguage === 'groovy' ? 'Groovy' : 'PowerShell'}
                {useBatchScript && <Badge variant="secondary" className="ml-1">Batch</Badge>}
              </span>
            }
          />
          {supportsAD && (
            <SummaryRow
              label="Instance Type"
              value={hasMultiInstances ? 'Multi-Instance' : 'Single Instance'}
            />
          )}
          {hasMultiInstances && adLanguage && (
            <SummaryRow
              label="AD Script"
              value={
                <span className="flex items-center gap-1.5">
                  <ActiveDiscoveryIcon className="size-4" />
                  {adLanguage === 'groovy' ? 'Groovy' : 'PowerShell'}
                </span>
              }
            />
          )}
        </div>
      </div>

      {/* Default Settings Info */}
      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          <p className="font-medium">Default Settings Applied</p>
          <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
            <li>
              <strong>AppliesTo:</strong> <code className="text-primary">false()</code> — module is
              deactivated until you configure targeting
            </li>
            {moduleType !== 'propertysource' && (
              <li>
                <strong>Collect Interval:</strong> {getCollectIntervalDescription(moduleType)}
              </li>
            )}
            {moduleType === 'propertysource' && (
              <li>
                <strong>Schedule:</strong> Runs on device discovery and property changes
              </li>
            )}
            <li>
              <strong>Scripts:</strong> Empty stubs ready for your code
            </li>
            {moduleType === 'datasource' && (
              <li>
                <strong>DataPoint:</strong> Default <code className="text-primary">exitCode</code> datapoint included
              </li>
            )}
            {moduleType === 'configsource' && (
              <li>
                <strong>Config Check:</strong> Default <code className="text-primary">RetrievalCheck</code> for config retrieval alerts
              </li>
            )}
          </ul>
        </AlertDescription>
      </Alert>

      {/* Warning about portal changes */}
      <Alert variant="warning">
        <AlertTriangle className="size-4" />
        <AlertDescription>
          This will create a new module in your portal immediately. You can edit the module
          details and scripts after creation.
        </AlertDescription>
      </Alert>
    </div>
  );
}
