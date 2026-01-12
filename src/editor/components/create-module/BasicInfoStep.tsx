/**
 * BasicInfoStep - Step 2: Enter module name and display name
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BasicInfoStepProps {
  name: string;
  displayName: string;
  onNameChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
}

// LogicMonitor module name validation: alphanumeric, underscores, hyphens
const NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

export function BasicInfoStep({
  name,
  displayName,
  onNameChange,
  onDisplayNameChange,
}: BasicInfoStepProps) {
  const nameError = name.length > 0 && !NAME_PATTERN.test(name)
    ? 'Name must start with a letter and contain only letters, numbers, underscores, and hyphens'
    : null;

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* Name Field */}
      <div className="space-y-2">
        <Label htmlFor="module-name" className="text-sm font-medium">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="module-name"
          type="text"
          placeholder="MyDataSource"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className={nameError ? 'border-destructive' : ''}
        />
        {nameError ? (
          <p className="text-xs text-destructive">{nameError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Technical name used in scripts and API. Must start with a letter.
          </p>
        )}
      </div>

      {/* Display Name Field */}
      <div className="space-y-2">
        <Label htmlFor="module-display-name" className="text-sm font-medium">
          Display Name
        </Label>
        <Input
          id="module-display-name"
          type="text"
          placeholder="My Data Source"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Human-readable name shown in the UI. Defaults to the technical name if not provided.
        </p>
      </div>
    </div>
  );
}
