import { Bell } from 'lucide-react';
import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useEditorStore } from '../../stores/editor-store';
import type { LogicModuleType } from '@/shared/types';
import { MODULE_TYPE_SCHEMAS } from '@/shared/module-type-schemas';

interface ModuleDetailsAlertSettingsProps {
  tabId: string;
  moduleType: LogicModuleType;
}

const ALERT_LEVEL_OPTIONS = [
  { label: 'Warn', value: 'warn' },
  { label: 'Error', value: 'error' },
  { label: 'Critical', value: 'critical' },
];

export function ModuleDetailsAlertSettings({ tabId, moduleType }: ModuleDetailsAlertSettingsProps) {
  const { moduleDetailsDraftByTabId, updateModuleDetailsField } = useEditorStore();
  const draft = moduleDetailsDraftByTabId[tabId];
  const schema = MODULE_TYPE_SCHEMAS[moduleType];
  const draftData = draft?.draft || {};

  const handleFieldChange = (field: string, value: unknown) => {
    updateModuleDetailsField(tabId, field, value);
  };

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (schema.requiredFields.includes('clearAfterAck')) {
      const value = draftData.clearAfterAck;
      if (value === undefined || value === null) {
        errors.clearAfterAck = 'Clear After ACK is required';
      }
    }
    if (schema.requiredFields.includes('alertEffectiveIval')) {
      const value = draftData.alertEffectiveIval;
      if (value === undefined || value === null || Number.isNaN(Number(value))) {
        errors.alertEffectiveIval = 'Auto Clear After is required';
      } else if (typeof value === 'number' && (value < 5 || value > 5760)) {
        errors.alertEffectiveIval = 'Auto Clear After must be between 5 and 5760 minutes';
      }
    }
    return errors;
  }, [draftData.alertEffectiveIval, draftData.clearAfterAck, schema]);

  if (!draft) {
    return (
      <div className="
        flex h-64 items-center justify-center text-muted-foreground
      ">
        Loading module details...
      </div>
    );
  }

  if (!schema.supportsAlertSettings) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5" />
            Alert Settings
          </CardTitle>
          <CardDescription>
            Configure default alert behavior for this event source
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="
            grid grid-cols-1 gap-4
            md:grid-cols-2
          ">
            <div className="space-y-2">
              <Label htmlFor="module-alert-level" className="
                text-sm font-medium
              ">
                Alert Level
              </Label>
              <Select
                value={draftData.alertLevel || 'warn'}
                onValueChange={(value) => handleFieldChange('alertLevel', value)}
              >
                <SelectTrigger id="module-alert-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALERT_LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="
                flex items-center justify-between gap-3 rounded-md border px-3
                py-2
              ">
                <Label htmlFor="module-clear-after-ack" className="
                  text-sm font-medium
                ">
                  Clear After ACK
                </Label>
                <Switch
                  id="module-clear-after-ack"
                  checked={Boolean(draftData.clearAfterAck)}
                  onCheckedChange={(checked) => handleFieldChange('clearAfterAck', checked)}
                />
              </div>
              {validationErrors.clearAfterAck && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" />
                  {validationErrors.clearAfterAck}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="module-alert-effective-ival" className="
                text-sm font-medium
              ">
                Auto Clear After (minutes) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="module-alert-effective-ival"
                type="number"
                min="5"
                max="5760"
                value={draftData.alertEffectiveIval ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  handleFieldChange('alertEffectiveIval', value === '' ? undefined : parseInt(value, 10));
                }}
                aria-invalid={!!validationErrors.alertEffectiveIval}
                className={validationErrors.alertEffectiveIval ? `
                  border-destructive
                ` : ''}
              />
              {validationErrors.alertEffectiveIval && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" />
                  {validationErrors.alertEffectiveIval}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="module-alert-subject" className="
              text-sm font-medium
            ">
              Alert Subject Template
            </Label>
            <Input
              id="module-alert-subject"
              value={draftData.alertSubjectTemplate || ''}
              onChange={(e) => handleFieldChange('alertSubjectTemplate', e.target.value)}
              placeholder="Subject template"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="module-alert-body" className="text-sm font-medium">
              Alert Body Template
            </Label>
            <Textarea
              id="module-alert-body"
              value={draftData.alertBodyTemplate || ''}
              onChange={(e) => handleFieldChange('alertBodyTemplate', e.target.value)}
              placeholder="Body template"
              rows={4}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
