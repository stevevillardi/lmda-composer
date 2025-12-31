export function normalizeApiPath(path: string): string {
  const trimmed = path.startsWith('/') ? path : `/${path}`;
  if (trimmed.startsWith('/santaba/rest')) {
    return trimmed;
  }
  return `/santaba/rest${trimmed}`;
}
