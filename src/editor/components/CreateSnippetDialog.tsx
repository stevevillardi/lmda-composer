import { useState, useEffect, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { FilePlus, Code2 } from 'lucide-react';
import { useEditorStore } from '../stores/editor-store';
import { getDefaultScriptTemplate } from '../config/script-templates';
import { buildMonacoOptions, getMonacoTheme } from '../utils/monaco-settings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Import the loader config to use bundled Monaco (CSP-safe)
import '../monaco-loader';

export function CreateSnippetDialog() {
  const {
    createSnippetDialogOpen,
    setCreateSnippetDialogOpen,
    editingSnippet,
    createUserSnippet,
    updateUserSnippet,
    tabs,
    activeTabId,
    preferences,
  } = useEditorStore();

  const activeTab = useMemo(() => {
    return tabs.find((tab) => tab.id === activeTabId) ?? null;
  }, [tabs, activeTabId]);

  const currentLanguage = activeTab?.language ?? 'groovy';
  const currentScript = activeTab?.content ?? getDefaultScriptTemplate(currentLanguage);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [snippetLanguage, setSnippetLanguage] = useState<'groovy' | 'powershell' | 'both'>('groovy');
  const [category, setCategory] = useState<'template' | 'pattern'>('pattern');
  const [tags, setTags] = useState('');
  const [code, setCode] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (editingSnippet) {
      setName(editingSnippet.name);
      setDescription(editingSnippet.description);
      setSnippetLanguage(editingSnippet.language);
      setCategory(editingSnippet.category);
      setTags(editingSnippet.tags.join(', '));
      setCode(editingSnippet.code);
    } else {
      // Default to current script content and language for new snippets
      setName('');
      setDescription('');
      setSnippetLanguage(currentLanguage);
      setCategory('pattern');
      setTags('');
      setCode(currentScript);
    }
  }, [editingSnippet, createSnippetDialogOpen, currentScript, currentLanguage]);

  const handleSubmit = () => {
    const snippetData = {
      name: name.trim(),
      description: description.trim(),
      language: snippetLanguage,
      category,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      code: code.trim(),
    };

    if (editingSnippet) {
      updateUserSnippet(editingSnippet.id, snippetData);
    } else {
      createUserSnippet(snippetData);
    }
  };

  const handleClose = () => {
    setCreateSnippetDialogOpen(false);
  };

  const isValid = name.trim() && code.trim();

  const monacoTheme = useMemo(() => getMonacoTheme(preferences), [preferences]);

  const editorOptions = useMemo(() => buildMonacoOptions(preferences, {
    fontSize: 12,
    lineNumbers: 'on',
    minimap: { enabled: false },
    wordWrap: 'off',
    tabSize: 2,
    renderLineHighlight: 'line',
    padding: { top: 8, bottom: 8 },
    scrollbar: { horizontal: 'auto', vertical: 'auto' },
  }), [preferences]);

  const monacoLanguage =
    snippetLanguage === 'both' ? currentLanguage : snippetLanguage;

  return (
    <Dialog open={createSnippetDialogOpen} onOpenChange={setCreateSnippetDialogOpen}>
      <DialogContent className="max-w-3xl!">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingSnippet ? (
              <>
                <Code2 className="size-5" />
                Edit Snippet
              </>
            ) : (
              <>
                <FilePlus className="size-5" />
                Create Snippet
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {editingSnippet
              ? 'Update your custom snippet'
              : 'Save code as a reusable snippet'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="snippet-name">Name *</Label>
            <Input
              id="snippet-name"
              placeholder="My Snippet"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="snippet-description">Description</Label>
            <Input
              id="snippet-description"
              placeholder="What does this snippet do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Language and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={snippetLanguage}
                onValueChange={(v) => setSnippetLanguage(v as typeof snippetLanguage)}
                items={[
                  { value: 'groovy', label: 'Groovy' },
                  { value: 'powershell', label: 'PowerShell' },
                  { value: 'both', label: 'Both' },
                ]}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="groovy">Groovy</SelectItem>
                  <SelectItem value="powershell">PowerShell</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as typeof category)}
                items={[
                  { value: 'template', label: 'Template' },
                  { value: 'pattern', label: 'Pattern' },
                ]}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">Template (replaces script)</SelectItem>
                  <SelectItem value="pattern">Pattern (inserts code)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="snippet-tags">Tags (comma-separated)</Label>
            <Input
              id="snippet-tags"
              placeholder="api, http, json"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          {/* Code */}
          <div className="space-y-2">
            <Label htmlFor="snippet-code">Code *</Label>
            <div className="rounded-md border border-border bg-muted/30 h-[260px] overflow-hidden">
              <Editor
                height="100%"
                language={monacoLanguage === 'powershell' ? 'powershell' : 'groovy'}
                theme={monacoTheme}
                value={code}
                onChange={(value) => setCode(value ?? '')}
                options={editorOptions}
                loading={
                  <div className="flex items-center justify-center h-full">
                    <div className="text-muted-foreground text-xs">Loading...</div>
                  </div>
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            {editingSnippet ? 'Save Changes' : 'Create Snippet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
