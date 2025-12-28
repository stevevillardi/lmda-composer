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
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { DEFAULT_PREFERENCES } from '@/shared/types';
import type { ScriptLanguage, ScriptMode, UserPreferences } from '@/shared/types';

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-6 py-3 px-1">
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Customize your LMDA Composer experience.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          <div className="space-y-6">
            {/* Appearance Card */}
            <Card size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Palette className="size-5 text-primary" />
                  </div>
                  Appearance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SettingRow label="Theme">
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
              </CardContent>
            </Card>

            {/* Defaults Card */}
            <Card size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Type className="size-5 text-primary" />
                  </div>
                  Defaults
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SettingRow label="Language">
                  <Select
                    value={preferences.defaultLanguage}
                    onValueChange={(value) => setPreferences({ defaultLanguage: value as ScriptLanguage })}
                    items={languageItems}
                  >
                    <SelectTrigger className="w-[130px] h-8">
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
                    <SelectTrigger className="w-[160px] h-8">
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
              </CardContent>
            </Card>

            {/* Editor Card */}
            <Card size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Code className="size-5 text-primary" />
                  </div>
                  Editor
                </CardTitle>
              </CardHeader>
              <CardContent>
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
                    className="w-[120px]"
                  />
                </SettingRow>
              </CardContent>
            </Card>
          </div>
        </div>

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

