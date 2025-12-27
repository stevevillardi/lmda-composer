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
    <div className="flex items-center justify-between gap-4 py-2">
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Customize your LogicMonitor IDE experience.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* Appearance & Defaults Row */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Palette className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Appearance</h3>
              </div>
              <SettingRow label="Theme">
                <Select
                  value={preferences.theme}
                  onValueChange={(value) => setPreferences({ theme: value as UserPreferences['theme'] })}
                  items={themeItems}
                >
                  <SelectTrigger className="w-[100px] h-8">
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
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Type className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Defaults</h3>
              </div>
              <SettingRow label="Language">
                <Select
                  value={preferences.defaultLanguage}
                  onValueChange={(value) => setPreferences({ defaultLanguage: value as ScriptLanguage })}
                  items={languageItems}
                >
                  <SelectTrigger className="w-[110px] h-8">
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
              <SettingRow label="Mode">
                <Select
                  value={preferences.defaultMode}
                  onValueChange={(value) => setPreferences({ defaultMode: value as ScriptMode })}
                  items={modeItems}
                >
                  <SelectTrigger className="w-[140px] h-8">
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
            </div>
          </div>

          <Separator />

          {/* Editor Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Code className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Editor</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <SettingRow label="Font Size" description={`${preferences.fontSize}px`}>
                <Slider
                  value={[preferences.fontSize]}
                  onValueChange={(value) => setPreferences({ fontSize: Array.isArray(value) ? value[0] : value })}
                  min={10}
                  max={24}
                  step={1}
                  className="w-[100px]"
                />
              </SettingRow>

              <SettingRow label="Tab Size" description={`${preferences.tabSize} spaces`}>
                <Slider
                  value={[preferences.tabSize]}
                  onValueChange={(value) => setPreferences({ tabSize: Array.isArray(value) ? value[0] : value })}
                  min={2}
                  max={8}
                  step={2}
                  className="w-[100px]"
                />
              </SettingRow>

              <SettingRow label="Word Wrap">
                <Switch
                  checked={preferences.wordWrap}
                  onCheckedChange={(checked) => setPreferences({ wordWrap: checked })}
                />
              </SettingRow>

              <SettingRow label="Minimap">
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
                  className="w-[100px]"
                />
              </SettingRow>
            </div>
          </div>
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

