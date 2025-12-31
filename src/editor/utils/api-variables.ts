import type { ApiEnvironmentVariable } from '@/shared/types';

const VARIABLE_REGEX = /\{\{\s*([\w.-]+)\s*\}\}/g;

export function buildApiVariableResolver(variables: ApiEnvironmentVariable[]) {
  const map = new Map(variables.map((variable) => [variable.key, variable.value]));

  return (value: string) => {
    if (!value) return value;
    return value.replace(VARIABLE_REGEX, (match, key) => {
      const resolved = map.get(String(key));
      return resolved !== undefined ? resolved : match;
    });
  };
}
