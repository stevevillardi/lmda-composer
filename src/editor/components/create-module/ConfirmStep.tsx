/**
 * ConfirmStep - Step 4: Review configuration and confirm creation
 */
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Info, AlertTriangle, FolderOpen } from 'lucide-react';
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
  initializeLocalDirectory: boolean;
  onInitializeLocalDirectoryChange: (checked: boolean) => void;
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

// Module types that only support Groovy
const GROOVY_ONLY_TYPES: LogicModuleType[] = ['logsource', 'eventsource'];

// Get collect interval description by module type
function getCollectIntervalDescription(moduleType: LogicModuleType): string {
  switch (moduleType) {
    case 'datasource':
    case 'logsource':
      return '5 minutes';
    case 'configsource':
    case 'topologysource':
      return '1 hour';
    case 'eventsource':
      return '30 minutes';
    case 'propertysource':
      return 'On device discovery';
    case 'diagnosticsource':
      return 'On-demand or via Diagnostic Rules';
    default:
      return '5 minutes';
  }
}

// Module types with no scheduled collection
const NO_SCHEDULED_COLLECTION_TYPES: LogicModuleType[] = ['propertysource', 'diagnosticsource'];

export function ConfirmStep({
  moduleType,
  name,
  displayName,
  collectionLanguage,
  hasMultiInstances,
  useBatchScript,
  adLanguage,
  initializeLocalDirectory,
  onInitializeLocalDirectoryChange,
}: ConfirmStepProps) {
  const moduleTypeInfo = LOGIC_MODULE_TYPES.find((t) => t.value === moduleType);
  const ModuleIcon = moduleTypeInfo?.icon;
  const supportsAD = AD_SUPPORTED_TYPES.includes(moduleType);
  const supportsDisplayName = DISPLAY_NAME_SUPPORTED_TYPES.includes(moduleType);
  const isGroovyOnly = GROOVY_ONLY_TYPES.includes(moduleType);

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
                {isGroovyOnly ? 'Groovy' : (collectionLanguage === 'groovy' ? 'Groovy' : 'PowerShell')}
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
            {!NO_SCHEDULED_COLLECTION_TYPES.includes(moduleType) && (
              <li>
                <strong>Collect Interval:</strong> {getCollectIntervalDescription(moduleType)}
              </li>
            )}
            {moduleType === 'propertysource' && (
              <li>
                <strong>Schedule:</strong> Runs on device discovery and property changes
              </li>
            )}
            {moduleType === 'diagnosticsource' && (
              <li>
                <strong>Schedule:</strong> {getCollectIntervalDescription(moduleType)}
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
            {moduleType === 'logsource' && (
              <li>
                <strong>Log Fields:</strong> Default resource type mapping included
              </li>
            )}
            {moduleType === 'eventsource' && (
              <li>
                <strong>Alert Level:</strong> Warning level with 60-minute effective interval
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

      {/* Local Directory Option */}
      <div className="rounded-lg border border-border bg-card/60 p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="init-local-dir"
            checked={initializeLocalDirectory}
            onCheckedChange={(checked) => onInitializeLocalDirectoryChange(checked === true)}
            className="mt-0.5"
          />
          <div className="flex-1 space-y-1">
            <Label
              htmlFor="init-local-dir"
              className="cursor-pointer text-sm font-medium leading-none"
            >
              <span className="flex items-center gap-1.5">
                <FolderOpen className="size-4" />
                Initialize local module directory
              </span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Save module to disk for version control and offline editing. You'll choose a folder after creation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
