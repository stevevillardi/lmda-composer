import { useEffect, useState, useCallback } from 'react';
import { Settings, Palette, Code, Braces } from 'lucide-react';
import { useEditorStore } from '../../stores/editor-store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DEFAULT_PREFERENCES } from '@/shared/types';
import type { ScriptLanguage, ScriptMode, UserPreferences } from '@/shared/types';

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="
      flex items-center justify-between gap-6 border-b border-border/50 py-3
      last:border-b-0
    ">
      <div className="flex-1 space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">
        {children}
      </div>
    </div>
  );
}

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  className?: string;
}

function NumberInput({ value, onChange, min, max, className }: NumberInputProps) {
  const [localValue, setLocalValue] = useState(String(value));

  // Sync local value when external value changes
  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const handleBlur = useCallback(() => {
    const parsed = Number(localValue);
    if (localValue === '' || Number.isNaN(parsed)) {
      // Reset to current value if empty or invalid
      setLocalValue(String(value));
    } else {
      // Clamp and apply
      const clamped = Math.max(min, Math.min(max, parsed));
      setLocalValue(String(clamped));
      onChange(clamped);
    }
  }, [localValue, value, min, max, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  }, [handleBlur]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
    />
  );
}

export function SettingsDialog() {
  const {
    settingsDialogOpen,
    setSettingsDialogOpen,
    preferences,
    setPreferences,
    loadPreferences,
  } = useEditorStore();

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleReset = () => {
    setPreferences(DEFAULT_PREFERENCES);
  };

  const themeItems = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'system', label: 'System' },
  ];

  const modeItems = [
    { value: 'freeform', label: 'Freeform' },
    { value: 'ad', label: 'Active Discovery' },
    { value: 'collection', label: 'Collection' },
    { value: 'batchcollection', label: 'Batch Collection' },
  ];

  const languageItems = [
    { value: 'groovy', label: 'Groovy' },
    { value: 'powershell', label: 'PowerShell' },
  ];

  return (
    <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Customize your LMDA Composer experience.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1 gap-1.5">
              <Palette className="size-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="editor" className="flex-1 gap-1.5">
              <Code className="size-4" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="api" className="flex-1 gap-1.5">
              <Braces className="size-4" />
              API Explorer
            </TabsTrigger>
          </TabsList>

          {/* General Tab - Appearance + Defaults */}
          <TabsContent value="general" className="mt-4 space-y-1">
            <SettingRow label="Theme">
              <Select
                value={preferences.theme}
                onValueChange={(value) => setPreferences({ theme: value as UserPreferences['theme'] })}
                items={themeItems}
              >
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {themeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow label="Default Language" description="Language for new files">
              <Select
                value={preferences.defaultLanguage}
                onValueChange={(value) => setPreferences({ defaultLanguage: value as ScriptLanguage })}
                items={languageItems}
              >
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow label="Default Mode" description="Script mode for new files">
              <Select
                value={preferences.defaultMode}
                onValueChange={(value) => setPreferences({ defaultMode: value as ScriptMode })}
                items={modeItems}
              >
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
          </TabsContent>

          {/* Editor Tab */}
          <TabsContent value="editor" className="mt-4 space-y-1">
            <SettingRow label="Font Size" description={`${preferences.fontSize}px`}>
              <Slider
                value={[preferences.fontSize]}
                onValueChange={(value) => setPreferences({ fontSize: Array.isArray(value) ? value[0] : value })}
                min={10}
                max={24}
                step={1}
                className="w-[120px]"
              />
            </SettingRow>

            <SettingRow label="Tab Size" description={`${preferences.tabSize} spaces`}>
              <Slider
                value={[preferences.tabSize]}
                onValueChange={(value) => setPreferences({ tabSize: Array.isArray(value) ? value[0] : value })}
                min={2}
                max={8}
                step={2}
                className="w-[120px]"
              />
            </SettingRow>

            <SettingRow label="Word Wrap" description="Wrap long lines">
              <Switch
                checked={preferences.wordWrap}
                onCheckedChange={(checked) => setPreferences({ wordWrap: checked })}
              />
            </SettingRow>

            <SettingRow label="Minimap" description="Show code minimap">
              <Switch
                checked={preferences.minimap}
                onCheckedChange={(checked) => setPreferences({ minimap: checked })}
              />
            </SettingRow>

            <SettingRow label="History Size" description={`${preferences.maxHistorySize} entries`}>
              <Slider
                value={[preferences.maxHistorySize]}
                onValueChange={(value) => setPreferences({ maxHistorySize: Array.isArray(value) ? value[0] : value })}
                min={10}
                max={100}
                step={10}
                className="w-[120px]"
              />
            </SettingRow>
          </TabsContent>

          {/* API Explorer Tab */}
          <TabsContent value="api" className="mt-4 space-y-1">
            <SettingRow label="History Limit" description="Max responses stored per portal (1–50)">
              <NumberInput
                value={preferences.apiHistoryLimit}
                onChange={(value) => setPreferences({ apiHistoryLimit: value })}
                min={1}
                max={50}
                className="h-8 w-[80px] text-center"
              />
            </SettingRow>

            <SettingRow label="Response Size Limit" description="Trim saved responses in KB (32–1024)">
              <NumberInput
                value={Math.round(preferences.apiResponseSizeLimit / 1024)}
                onChange={(value) => setPreferences({ apiResponseSizeLimit: value * 1024 })}
                min={32}
                max={1024}
                className="h-8 w-[80px] text-center"
              />
            </SettingRow>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <Button onClick={() => setSettingsDialogOpen(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
