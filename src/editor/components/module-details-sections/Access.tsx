import { useState, useMemo } from 'react';
import { Shield } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEditorStore } from '../../stores/editor-store';
import type { LogicModuleType } from '@/shared/types';
import { MODULE_TYPE_SCHEMAS } from '@/shared/module-type-schemas';

interface ModuleDetailsAccessProps {
  tabId: string;
  moduleType: LogicModuleType;
}

export function ModuleDetailsAccess({ tabId, moduleType }: ModuleDetailsAccessProps) {
  const {
    moduleDetailsDraftByTabId,
    accessGroups,
    updateModuleDetailsField,
  } = useEditorStore();

  const draft = moduleDetailsDraftByTabId[tabId];
  const schema = MODULE_TYPE_SCHEMAS[moduleType];
  const draftData = draft?.draft || {};

  const [accessGroupSearch, setAccessGroupSearch] = useState('');
  const anchorRef = useComboboxAnchor();


  // Access groups options for combobox
  const accessGroupOptions = useMemo(() => {
    if (!accessGroupSearch.trim()) {
      return accessGroups.map(ag => ({
        value: ag.id.toString(),
        label: ag.name,
      }));
    }
    const query = accessGroupSearch.toLowerCase();
    return accessGroups
      .filter(ag => ag.name.toLowerCase().includes(query))
      .map(ag => ({
        value: ag.id.toString(),
        label: ag.name,
      }));
  }, [accessGroups, accessGroupSearch]);

  // Selected access group IDs
  const selectedAccessGroupIds = useMemo(() => {
    const ids = draftData.accessGroupIds;
    if (Array.isArray(ids)) {
      return ids.map(id => id.toString());
    }
    if (typeof ids === 'string') {
      return ids.split(',').map(id => id.trim()).filter(Boolean);
    }
    return [];
  }, [draftData.accessGroupIds]);

  const handleAccessGroupChange = (value: string[] | string | null | undefined) => {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    const numericIds = values.map(v => parseInt(v, 10)).filter(id => !isNaN(id));
    updateModuleDetailsField(tabId, 'accessGroupIds', numericIds);
  };


  if (!draft) {
    return (
      <div className="
        flex h-64 items-center justify-center text-muted-foreground
      ">
        Loading module details...
      </div>
    );
  }

  if (!schema.editableFields.includes('accessGroupIds') || !schema.accessGroupSupport) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Access Control
          </CardTitle>
          <CardDescription>
            Control who can access and manage this module
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="module-access-groups" className="
              text-sm font-medium
            ">
              Access Groups
            </Label>
            <Combobox
              multiple
              value={selectedAccessGroupIds}
              onValueChange={(value) => handleAccessGroupChange(value)}
              inputValue={accessGroupSearch}
              onInputValueChange={(value) => setAccessGroupSearch(value)}
            >
              <ComboboxChips ref={anchorRef} className="w-full">
                {selectedAccessGroupIds.map((id) => {
                  const ag = accessGroups.find(a => a.id.toString() === id);
                  return (
                    <ComboboxChip 
                      key={id}
                    >
                      {ag?.name || id}
                    </ComboboxChip>
                  );
                })}
                <ComboboxChipsInput
                  placeholder={selectedAccessGroupIds.length === 0 ? "Select access groups..." : ""}
                />
              </ComboboxChips>
              <ComboboxContent anchor={anchorRef}>
                <ComboboxList>
                  {accessGroupOptions.length === 0 ? (
                    <ComboboxEmpty>No access groups found</ComboboxEmpty>
                  ) : (
                    accessGroupOptions.map((option) => {
                      return (
                        <ComboboxItem
                          key={option.value}
                          value={option.value}
                          onSelect={() => {
                            // Clear search after selection
                            setAccessGroupSearch('');
                          }}
                        >
                          {option.label}
                        </ComboboxItem>
                      );
                    })
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <p className="text-xs text-muted-foreground">
              Users in selected access groups will be able to view and edit this module
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
