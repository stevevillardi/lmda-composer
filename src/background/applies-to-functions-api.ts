import type { CustomAppliesToFunction } from '@/shared/types';

const API_VERSION = '3';

interface APIResponse<T> {
  items?: T[];
  data?: T;
  error?: {
    errorMessage: string;
    errorCode: number;
    errorDetail: string | null;
  };
}

/**
 * Fetch all custom AppliesTo functions for a portal
 */
export async function fetchCustomFunctions(
  portalId: string,
  csrfToken: string | null
): Promise<CustomAppliesToFunction[]> {
  const portal = portalId.includes('.') ? portalId : `${portalId}.logicmonitor.com`;
  const url = `https://${portal}/santaba/rest/setting/functions`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-version': API_VERSION,
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('CSRF token expired or invalid');
    }
    if (response.status === 401) {
      throw new Error('Session expired - please log in to LogicMonitor');
    }
    throw new Error(`Failed to fetch custom functions: ${response.status} ${response.statusText}`);
  }

  const data: APIResponse<CustomAppliesToFunction> = await response.json();
  
  // Handle different response formats
  if (data.items) {
    return data.items;
  }
  if (Array.isArray(data)) {
    return data as CustomAppliesToFunction[];
  }
  if (data.data && Array.isArray(data.data)) {
    return data.data;
  }
  
  return [];
}

/**
 * Create a new custom AppliesTo function
 */
export async function createCustomFunction(
  portalId: string,
  csrfToken: string | null,
  functionData: { name: string; code: string; description?: string }
): Promise<CustomAppliesToFunction> {
  const portal = portalId.includes('.') ? portalId : `${portalId}.logicmonitor.com`;
  const url = `https://${portal}/santaba/rest/setting/functions`;

  const payload: Record<string, string> = {
    name: functionData.name,
    code: functionData.code,
  };
  
  if (functionData.description) {
    payload.description = functionData.description;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-version': API_VERSION,
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.errorMessage || errorData.message || `Failed to create function: ${response.status}`;
    throw new Error(errorMessage);
  }

  const data: CustomAppliesToFunction = await response.json();
  return data;
}

/**
 * Update an existing custom AppliesTo function
 */
export async function updateCustomFunction(
  portalId: string,
  csrfToken: string | null,
  functionId: number,
  functionData: { name: string; code: string; description?: string }
): Promise<CustomAppliesToFunction> {
  const portal = portalId.includes('.') ? portalId : `${portalId}.logicmonitor.com`;
  const url = `https://${portal}/santaba/rest/setting/functions/${functionId}`;

  const payload: Record<string, string> = {
    name: functionData.name,
    code: functionData.code,
  };
  
  if (functionData.description !== undefined) {
    payload.description = functionData.description;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-version': API_VERSION,
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.errorMessage || errorData.message || `Failed to update function: ${response.status}`;
    throw new Error(errorMessage);
  }

  const data: CustomAppliesToFunction = await response.json();
  return data;
}

/**
 * Delete a custom AppliesTo function
 */
export async function deleteCustomFunction(
  portalId: string,
  csrfToken: string | null,
  functionId: number
): Promise<void> {
  const portal = portalId.includes('.') ? portalId : `${portalId}.logicmonitor.com`;
  const url = `https://${portal}/santaba/rest/setting/functions/${functionId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-version': API_VERSION,
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.errorMessage || errorData.message || `Failed to delete function: ${response.status}`;
    throw new Error(errorMessage);
  }
}

