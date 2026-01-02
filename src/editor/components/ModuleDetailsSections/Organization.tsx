import { useState } from 'react';
import { FolderTree, Eye, EyeOff } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEditorStore } from '../../stores/editor-store';
import type { LogicModuleType } from '@/shared/types';
import { MODULE_TYPE_SCHEMAS } from '@/shared/module-type-schemas';
import ReactMarkdown from 'react-markdown';

interface ModuleDetailsOrganizationProps {
  tabId: string;
  moduleType: LogicModuleType;
}

export function ModuleDetailsOrganization({ tabId, moduleType }: ModuleDetailsOrganizationProps) {
  const {
    moduleDetailsDraftByTabId,
    updateModuleDetailsField,
  } = useEditorStore();

  const draft = moduleDetailsDraftByTabId[tabId];
  const schema = MODULE_TYPE_SCHEMAS[moduleType];
  const draftData = draft?.draft || {};
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);

  const handleFieldChange = (field: string, value: unknown) => {
    updateModuleDetailsField(tabId, field, value);
  };

  if (!draft) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading module details...
      </div>
    );
  }

  const hasFields = schema.editableFields.includes('group') || 
    schema.editableFields.includes('technology') || 
    schema.editableFields.includes('tags');

  if (!hasFields) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="size-5" />
            Organization
          </CardTitle>
          <CardDescription>
            Categorization and tagging for better organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Group */}
            {schema.editableFields.includes('group') && (
              <div className="space-y-2">
                <Label htmlFor="module-group" className="text-sm font-medium">
                  Group
                </Label>
                <Input
                  id="module-group"
                  value={draftData.group || ''}
                  onChange={(e) => handleFieldChange('group', e.target.value)}
                  placeholder="Module group"
                />
              </div>
            )}

            {/* Tags */}
            {schema.editableFields.includes('tags') && (
              <div className="space-y-2">
                <Label htmlFor="module-tags" className="text-sm font-medium">
                  Tags
                </Label>
                <Input
                  id="module-tags"
                  value={draftData.tags || ''}
                  onChange={(e) => handleFieldChange('tags', e.target.value)}
                  placeholder="Comma-separated tags"
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple tags with commas
                </p>
              </div>
            )}
          </div>

          {/* Technology */}
          {schema.editableFields.includes('technology') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="module-technology" className="text-sm font-medium">
                  Technical Notes
                </Label>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${(draftData.technology?.length || 0) > 4096 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {(draftData.technology?.length || 0)} / 4096
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMarkdownPreview(!showMarkdownPreview)}
                    className="h-7 px-2"
                  >
                    {showMarkdownPreview ? (
                      <>
                        <EyeOff className="size-3.5 mr-1.5" />
                        Hide Preview
                      </>
                    ) : (
                      <>
                        <Eye className="size-3.5 mr-1.5" />
                        Show Preview
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {showMarkdownPreview ? (
                <div className="min-h-[80px] max-h-[300px] overflow-y-auto p-3 rounded-md border border-input bg-muted/50 prose prose-sm dark:prose-invert max-w-none">
                  {draftData.technology ? (
                    <ReactMarkdown>{draftData.technology}</ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground text-sm">No content to preview</p>
                  )}
                </div>
              ) : (
                <Textarea
                  id="module-technology"
                  value={draftData.technology || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 4096) {
                      handleFieldChange('technology', value);
                    }
                  }}
                  placeholder="Technical notes (supports Markdown)"
                  rows={3}
                  className="resize-none"
                  aria-invalid={(draftData.technology?.length || 0) > 4096}
                />
              )}
              {(draftData.technology?.length || 0) > 4096 && (
                <p className="text-xs text-destructive">
                  Technical Notes cannot exceed 4096 characters
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

