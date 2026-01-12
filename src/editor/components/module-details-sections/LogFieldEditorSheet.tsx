import { useState, useEffect } from 'react';
import { Tags } from 'lucide-react';
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
import type { LogSourceLogField, LogSourceFieldMethod } from '@/shared/types';

interface LogFieldEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logField: Partial<LogSourceLogField> | null;
  existingKeys: string[];
  onSave: (logField: LogSourceLogField) => void;
  isNew: boolean;
}

// Method options
const METHOD_OPTIONS: Array<{ label: string; value: LogSourceFieldMethod; description: string; placeholder: string }> = [
  { 
    label: 'Static', 
    value: 'Static', 
    description: 'A fixed value that does not change',
    placeholder: 'Enter static value...',
  },
  { 
    label: 'Dynamic (Regex)', 
    value: 'Regex', 
    description: 'Extract value from the message field using regex',
    placeholder: 'Enter regex pattern (e.g., host=*)...',
  },
  { 
    label: 'LM Property (Token)', 
    value: 'Token', 
    description: 'Use a LogicMonitor device property',
    placeholder: 'Enter token (e.g., ##system.deviceId##)...',
  },
];

// Create default log field
function createDefaultLogField(): LogSourceLogField {
  return {
    key: '',
    method: 'Static',
    value: '',
    comment: '',
  };
}

export function LogFieldEditorSheet({
  open,
  onOpenChange,
  logField,
  existingKeys,
  onSave,
  isNew,
}: LogFieldEditorSheetProps) {
  // Form state
  const [key, setKey] = useState('');
  const [method, setMethod] = useState<LogSourceFieldMethod>('Static');
  const [value, setValue] = useState('');
  const [comment, setComment] = useState('');

  // Reset form when logField changes
  useEffect(() => {
    if (open) {
      if (logField) {
        setKey(logField.key || '');
        setMethod(logField.method || 'Static');
        setValue(logField.value || '');
        setComment(logField.comment || '');
      } else {
        const defaultField = createDefaultLogField();
        setKey(defaultField.key);
        setMethod(defaultField.method);
        setValue(defaultField.value);
        setComment(defaultField.comment);
      }
    }
  }, [open, logField]);

  // Validation
  const keyTrimmed = key.trim();
  const isKeyDuplicate = isNew 
    ? existingKeys.includes(keyTrimmed) 
    : existingKeys.filter(k => k !== logField?.key).includes(keyTrimmed);
  const isValid = keyTrimmed.length > 0 && value.trim().length > 0 && !isKeyDuplicate;

  // Get current method option for placeholder
  const currentMethodOption = METHOD_OPTIONS.find(m => m.value === method);

  const handleSave = () => {
    if (!isValid) return;

    const savedField: LogSourceLogField = {
      id: logField?.id,
      key: keyTrimmed,
      method,
      value: value.trim(),
      comment: comment.trim(),
    };

    onSave(savedField);
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
            <Tags className="size-5" />
            {isNew ? 'Add Log Field' : 'Edit Log Field'}
          </SheetTitle>
          <SheetDescription>
            {isNew
              ? 'Create a log field to send additional metadata with logs.'
              : 'Edit the log field configuration.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {/* Key */}
            <div className="space-y-2">
              <Label htmlFor="key">
                Key <span className="text-destructive">*</span>
              </Label>
              <Input
                id="key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter field key (e.g., Customer, Host)..."
              />
              {isKeyDuplicate && (
                <p className="text-xs text-destructive">A log field with this key already exists.</p>
              )}
              <p className="text-xs text-muted-foreground">
                The tag name that will be sent with the log data.
              </p>
            </div>

            {/* Method */}
            <div className="space-y-2">
              <Label htmlFor="method">Method</Label>
              <Select value={method} onValueChange={(val) => setMethod(val as LogSourceFieldMethod)}>
                <SelectTrigger id="method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span>{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How to determine the value for this log field.
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
                placeholder={currentMethodOption?.placeholder || 'Enter value...'}
              />
              <p className="text-xs text-muted-foreground">
                {method === 'Static' && 'The fixed value to use for this field.'}
                {method === 'Regex' && 'The regex pattern to extract a value from the message.'}
                {method === 'Token' && 'The LM property token (e.g., ##system.deviceId##).'}
              </p>
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <Label htmlFor="comment">Comment</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional description of this log field..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Optional comment to describe the purpose of this log field.
              </p>
            </div>
          </div>
        </div>

        <SheetFooter className="shrink-0 border-t px-6 py-4">
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            {isNew ? 'Add Log Field' : 'Save Changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
