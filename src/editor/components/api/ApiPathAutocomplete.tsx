import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxLabel,
} from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
import type { ApiEndpointDefinition } from '@/editor/data/api-schema';
import type { ApiRequestMethod } from '@/shared/types';
import { COLORS } from '@/editor/constants/colors';

interface ApiPathAutocompleteProps {
  value: string;
  method: ApiRequestMethod;
  endpoints: ApiEndpointDefinition[];
  onChange: (path: string) => void;
  onSelectEndpoint?: (endpoint: ApiEndpointDefinition) => void;
  className?: string;
}

interface GroupedEndpoints {
  tag: string;
  endpoints: ApiEndpointDefinition[];
}

export function ApiPathAutocomplete({
  value,
  method,
  endpoints,
  onChange,
  onSelectEndpoint,
  className,
}: ApiPathAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);

  // Sync internal state when value prop changes externally (e.g., sidebar selection)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Filter endpoints by method and search query
  const filteredEndpoints = useMemo(() => {
    const query = inputValue.toLowerCase().trim();
    return endpoints.filter((endpoint) => {
      // Match by method
      if (endpoint.method !== method) return false;
      // Match by path or summary
      if (!query) return true;
      return (
        endpoint.path.toLowerCase().includes(query) ||
        (endpoint.summary ?? '').toLowerCase().includes(query)
      );
    });
  }, [endpoints, method, inputValue]);

  // Group filtered endpoints by tag
  const groupedEndpoints = useMemo<GroupedEndpoints[]>(() => {
    const grouped = new Map<string, ApiEndpointDefinition[]>();
    filteredEndpoints.forEach((endpoint) => {
      const list = grouped.get(endpoint.tag) ?? [];
      list.push(endpoint);
      grouped.set(endpoint.tag, list);
    });
    return Array.from(grouped.entries())
      .map(([tag, endpoints]) => ({ tag, endpoints }))
      .sort((a, b) => a.tag.localeCompare(b.tag));
  }, [filteredEndpoints]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      setInputValue(newValue);
      onChange(newValue);
    },
    [onChange]
  );

  const handleSelect = useCallback(
    (selectedValue: string | null) => {
      if (!selectedValue) return;
      
      const endpoint = endpoints.find(
        (e) => e.path === selectedValue && e.method === method
      );
      
      setInputValue(selectedValue);
      onChange(selectedValue);
      
      if (endpoint && onSelectEndpoint) {
        onSelectEndpoint(endpoint);
      }
    },
    [endpoints, method, onChange, onSelectEndpoint]
  );

  return (
    <Combobox
      value={value}
      onValueChange={handleSelect}
      inputValue={inputValue}
      onInputValueChange={(newValue: string) => {
        setInputValue(newValue);
        onChange(newValue);
      }}
    >
      <ComboboxInput
        placeholder="/device/devices"
        className={cn('h-8 flex-1 font-mono text-xs', className)}
        showTrigger={false}
        showClear={false}
        onChange={handleInputChange}
      />
      <ComboboxContent className="w-[500px]">
        <ComboboxList className="p-1">
          <ComboboxEmpty className="py-6 text-center text-xs text-muted-foreground">
            No matching endpoints found
          </ComboboxEmpty>
          {groupedEndpoints.map((group) => (
            <ComboboxGroup key={group.tag}>
              <ComboboxLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 bg-muted/30">
                {group.tag}
              </ComboboxLabel>
              {group.endpoints.map((endpoint) => (
                <ComboboxItem
                  key={endpoint.id}
                  value={endpoint.path}
                  className="flex flex-col items-start gap-1 py-2 px-2.5 mx-1 my-0.5 rounded-md border-l-2 border-transparent aria-selected:bg-accent/50 aria-selected:border-primary aria-selected:text-accent-foreground cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2 w-full min-w-0">
                    <span
                      className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-tight min-w-[36px] text-center',
                        COLORS.METHOD[endpoint.method].bgSubtle,
                        COLORS.METHOD[endpoint.method].text
                      )}
                    >
                      {endpoint.method}
                    </span>
                    <span className="font-mono text-xs truncate text-foreground/90">
                      {endpoint.path}
                    </span>
                  </div>
                  {endpoint.summary && (
                    <span className="text-[10px] text-muted-foreground truncate w-full pl-[46px]">
                      {endpoint.summary}
                    </span>
                  )}
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

