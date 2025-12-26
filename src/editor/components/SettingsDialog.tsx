import { useEffect } from 'react';
import { Settings, Palette, Code, Type } from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Separator } from '@/components/ui/separator';
import { DEFAULT_PREFERENCES } from '@/shared/types';
import type { ScriptLanguage, ScriptMode, UserPreferences } from '@/shared/types';

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Customize your LM IDE experience.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Appearance Section */}
          <div className="flex items-center gap-2 mb-2">
            <Palette className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Appearance</h3>
          </div>
          
          <SettingRow label="Theme" description="Choose the color theme">
            <Select
              value={preferences.theme}
              onValueChange={(value) => setPreferences({ theme: value as UserPreferences['theme'] })}
              items={themeItems}
            >
              <SelectTrigger className="w-[120px] h-8">
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

          <Separator className="my-2" />

          {/* Editor Section */}
          <div className="flex items-center gap-2 mb-2 mt-4">
            <Code className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Editor</h3>
          </div>

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

          <SettingRow label="Minimap" description="Show code overview">
            <Switch
              checked={preferences.minimap}
              onCheckedChange={(checked) => setPreferences({ minimap: checked })}
            />
          </SettingRow>

          <Separator className="my-2" />

          {/* Defaults Section */}
          <div className="flex items-center gap-2 mb-2 mt-4">
            <Type className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Defaults</h3>
          </div>

          <SettingRow label="Default Language">
            <Select
              value={preferences.defaultLanguage}
              onValueChange={(value) => setPreferences({ defaultLanguage: value as ScriptLanguage })}
              items={languageItems}
            >
              <SelectTrigger className="w-[120px] h-8">
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

          <SettingRow label="Default Mode">
            <Select
              value={preferences.defaultMode}
              onValueChange={(value) => setPreferences({ defaultMode: value as ScriptMode })}
              items={modeItems}
            >
              <SelectTrigger className="w-[150px] h-8">
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

          <SettingRow label="History Size" description={`Keep ${preferences.maxHistorySize} entries`}>
            <Slider
              value={[preferences.maxHistorySize]}
              onValueChange={(value) => setPreferences({ maxHistorySize: Array.isArray(value) ? value[0] : value })}
              min={10}
              max={100}
              step={10}
              className="w-[120px]"
            />
          </SettingRow>
        </div>

        <DialogFooter>
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

