import { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { LogSourceFilter, LogSourceFilterOperator } from '@/shared/types';

interface FilterEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: Partial<LogSourceFilter> | null;
  onSave: (filter: LogSourceFilter) => void;
  isNew: boolean;
}

// Operator options
const OPERATOR_OPTIONS: Array<{ label: string; value: LogSourceFilterOperator; description: string }> = [
  { label: 'Equals', value: 'Equal', description: 'Message equals the value exactly' },
  { label: 'Not Equals', value: 'NotEqual', description: 'Message does not equal the value' },
  { label: 'Contains', value: 'Contain', description: 'Message contains the value' },
  { label: 'Not Contains', value: 'NotContain', description: 'Message does not contain the value' },
  { label: 'Regex Match', value: 'RegexMatch', description: 'Message matches the regex pattern' },
  { label: 'Regex Not Match', value: 'RegexNotMatch', description: 'Message does not match the regex pattern' },
];

// Create default filter
function createDefaultFilter(): LogSourceFilter {
  return {
    index: '',
    attribute: 'Message',
    operator: 'Contain',
    value: '',
    comment: '',
    include: 'y',
  };
}

export function FilterEditorSheet({
  open,
  onOpenChange,
  filter,
  onSave,
  isNew,
}: FilterEditorSheetProps) {
  // Form state
  const [operator, setOperator] = useState<LogSourceFilterOperator>('Contain');
  const [value, setValue] = useState('');
  const [comment, setComment] = useState('');

  // Reset form when filter changes
  useEffect(() => {
    if (open) {
      if (filter) {
        setOperator(filter.operator || 'Contain');
        setValue(filter.value || '');
        setComment(filter.comment || '');
      } else {
        const defaultFilter = createDefaultFilter();
        setOperator(defaultFilter.operator);
        setValue(defaultFilter.value);
        setComment(defaultFilter.comment);
      }
    }
  }, [open, filter]);

  // Validation
  const isValid = value.trim().length > 0;

  const handleSave = () => {
    if (!isValid) return;

    const savedFilter: LogSourceFilter = {
      id: filter?.id,
      index: '',
      attribute: 'Message',
      operator,
      value: value.trim(),
      comment: comment.trim(),
      include: 'y',
    };

    onSave(savedFilter);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[500px] flex-col gap-0 p-0 sm:max-w-[500px]">
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            <Filter className="size-5" />
            {isNew ? 'Add Include Filter' : 'Edit Include Filter'}
          </SheetTitle>
          <SheetDescription>
            {isNew
              ? 'Create a filter to include log messages that match the criteria.'
              : 'Edit the filter criteria for including log messages.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {/* Operator */}
            <div className="space-y-2">
              <Label htmlFor="operator">Operator</Label>
              <Select value={operator} onValueChange={(val) => setOperator(val as LogSourceFilterOperator)}>
                <SelectTrigger id="operator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATOR_OPTIONS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      <div className="flex flex-col">
                        <span>{op.label}</span>
                        <span className="text-xs text-muted-foreground">{op.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How to compare the Message attribute against the value.
              </p>
            </div>

            {/* Value */}
            <div className="space-y-2">
              <Label htmlFor="value">
                Value <span className="text-destructive">*</span>
              </Label>
              <Input
                id="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={operator.includes('Regex') ? 'Enter regex pattern...' : 'Enter filter value...'}
              />
              <p className="text-xs text-muted-foreground">
                {operator.includes('Regex')
                  ? 'The regular expression pattern to match against the message.'
                  : 'The string value to match against the message.'}
              </p>
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <Label htmlFor="comment">Comment</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional description of this filter..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Optional comment to describe the purpose of this filter.
              </p>
            </div>
          </div>
        </div>

        <SheetFooter className="shrink-0 border-t px-6 py-4">
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            {isNew ? 'Add Filter' : 'Save Changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
