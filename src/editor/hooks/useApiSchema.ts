import { useCallback, useEffect, useState } from 'react';
import { loadApiSchema, resetApiSchemaCache, type ApiSchema } from '@/editor/data/api-schema';

interface ApiSchemaState {
  schema: ApiSchema | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

export function useApiSchema(): ApiSchemaState {
  const [schema, setSchema] = useState<ApiSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    loadApiSchema()
      .then((data) => {
        if (!isActive) return;
        setSchema(data);
        setError(null);
      })
      .catch((err) => {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : 'Failed to load API schema');
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const retry = useCallback(() => {
    resetApiSchemaCache();
    setIsLoading(true);
    loadApiSchema()
      .then((data) => {
        setSchema(data);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load API schema');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return { schema, isLoading, error, retry };
}
