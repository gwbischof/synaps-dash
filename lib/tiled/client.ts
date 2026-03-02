import { TiledSearchResponse, TiledNode, DatasetItem } from './types';
import { getAuthHeader, getValidAccessToken, getAuthType, clearTokens } from './auth';

// Use local API proxy to avoid CORS issues
const API_BASE = '/api/tiled';

// Keep original URL for reference/WebSocket
const TILED_URL = process.env.NEXT_PUBLIC_TILED_URL || 'https://tiled.nsls2.bnl.gov';

// Event emitter for auth errors - allows components to react to 401s
type AuthErrorListener = () => void;
const authErrorListeners: Set<AuthErrorListener> = new Set();

export function onAuthError(listener: AuthErrorListener): () => void {
  authErrorListeners.add(listener);
  return () => authErrorListeners.delete(listener);
}

function notifyAuthError(): void {
  authErrorListeners.forEach(listener => listener());
}

// Get a valid auth header, refreshing token if needed
async function getValidAuthHeader(): Promise<string | null> {
  const token = await getValidAccessToken();
  if (!token) {
    console.log('[Client] No valid token available');
    return null;
  }

  const authType = getAuthType();
  return authType === 'apikey' ? `Apikey ${token}` : `Bearer ${token}`;
}

async function fetchWithAuth(url: string, options: RequestInit = {}, isRetry = false): Promise<Response> {
  const authHeader = await getValidAuthHeader();

  const headers = new Headers(options.headers);
  if (authHeader) {
    headers.set('Authorization', authHeader);
  }

  const response = await fetch(url, { ...options, headers });

  // On 401, try to refresh and retry once
  if (response.status === 401 && !isRetry) {
    console.log('[Client] Got 401, attempting token refresh and retry...');
    const { refreshAccessToken } = await import('./auth');
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      console.log('[Client] Token refreshed, retrying request...');
      return fetchWithAuth(url, options, true);
    }

    // Refresh failed - clear tokens and notify
    console.log('[Client] Token refresh failed, logging out');
    clearTokens();
    notifyAuthError();
  }

  return response;
}

export interface ListChildrenOptions {
  offset?: number;
  limit?: number;
  sort?: string;
  fullText?: string;
  filters?: Record<string, string>;
}

// Parse search query for field-specific filters
// Supports: "scan_id:12345", "element:Fe", or just "12345" (treated as scan_id)
function parseSearchQuery(query: string): { fullText?: string; fieldFilters: Record<string, string> } {
  const trimmed = query.trim();
  if (!trimmed) return { fieldFilters: {} };

  const fieldFilters: Record<string, string> = {};

  // Check for field:value patterns
  const fieldPattern = /^(\w+):(.+)$/;
  const match = trimmed.match(fieldPattern);

  if (match) {
    const [, field, value] = match;
    fieldFilters[field] = value.trim();
    return { fieldFilters };
  }

  // If it's just a number, treat as scan_id search
  if (/^\d+$/.test(trimmed)) {
    fieldFilters['scan_id'] = trimmed;
    return { fieldFilters };
  }

  // Otherwise, use fulltext search
  return { fullText: trimmed, fieldFilters: {} };
}

export async function listChildren(
  path: string,
  options: ListChildrenOptions = {}
): Promise<{ items: DatasetItem[]; hasMore: boolean; totalCount: number }> {
  // Determine appropriate sort based on path
  // - "raw" collections (databroker) use scan_id
  // - synaps reconstructions/segmentations use time_created
  // - Other collections use "_" for default ordering
  const getDefaultSort = (p: string): string => {
    if (p.includes('/raw')) return '-scan_id';
    if (p.includes('synaps/reconstructions') || p.includes('synaps/segmentations')) return '-time_created';
    return '-_';
  };
  const { offset = 0, limit = 20, sort = getDefaultSort(path), fullText, filters } = options;

  const url = new URL(`${API_BASE}/search/${path}`, window.location.origin);
  url.searchParams.set('page[offset]', offset.toString());
  url.searchParams.set('page[limit]', limit.toString());
  if (sort) {
    url.searchParams.set('sort', sort);
  }

  // Parse and apply search query
  if (fullText && fullText.trim()) {
    const parsed = parseSearchQuery(fullText);

    // Apply fulltext search if present
    if (parsed.fullText) {
      url.searchParams.set('filter[fulltext][condition][text]', parsed.fullText);
    }

    // Apply field-specific Eq filters
    for (const [field, value] of Object.entries(parsed.fieldFilters)) {
      url.searchParams.set('filter[eq][condition][key]', field);
      url.searchParams.set('filter[eq][condition][value]', value);
    }
  }

  // Add additional filters if provided
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetchWithAuth(url.toString());

  if (!response.ok) {
    throw new Error(`Failed to list children: ${response.status} ${response.statusText}`);
  }

  const data: TiledSearchResponse<TiledNode> = await response.json();

  const items: DatasetItem[] = data.data.map((node) => ({
    id: node.id,
    path: `${path}/${node.id}`,
    metadata: node.attributes.metadata,
    structureFamily: node.attributes.structure_family,
    specs: node.attributes.specs?.map((s) => s.name) || [],
    shape: node.attributes.structure?.shape,
    timeCreated: findTimestamp(node.attributes.metadata),
  }));

  function findTimestamp(metadata: Record<string, unknown>): string | undefined {
    if (!metadata) return undefined;

    // Common timestamp field names
    const timestampKeys = [
      'time_created',
      'time',
      'timestamp',
      'created_at',
      'creation_time',
      'date',
      'datetime',
    ];

    for (const key of timestampKeys) {
      if (metadata[key] !== undefined) {
        const value = metadata[key];
        // Handle both string timestamps and unix timestamps
        if (typeof value === 'string') return value;
        if (typeof value === 'number') {
          // Unix timestamp (seconds) - convert to ISO string
          return new Date(value * 1000).toISOString();
        }
      }
    }

    // Check nested in start document
    if (metadata.start && typeof metadata.start === 'object') {
      const start = metadata.start as Record<string, unknown>;
      if (start.time !== undefined) {
        const value = start.time;
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return new Date(value * 1000).toISOString();
      }
    }

    // Check export_timestamp
    if (metadata.export_timestamp !== undefined) {
      const value = metadata.export_timestamp;
      if (typeof value === 'number') return new Date(value * 1000).toISOString();
    }

    return undefined;
  }

  return {
    items,
    hasMore: data.links.next !== null,
    totalCount: data.meta.count,
  };
}

export async function getMetadata(path: string): Promise<Record<string, unknown>> {
  const url = `${API_BASE}/metadata/${path}`;
  const response = await fetchWithAuth(url);

  if (!response.ok) {
    throw new Error(`Failed to get metadata: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.attributes.metadata;
}

export function getThumbnailUrl(path: string, cmap: string = 'viridis', slice: number = 0): string {
  return `${API_BASE}/array/full/${path}?format=image/png&cmap=${cmap}&slice=${slice}`;
}

export function getPngUrl(path: string, cmap: string = 'viridis'): string {
  return `${API_BASE}/array/full/${path}?format=image/png&cmap=${cmap}`;
}

export function getArrayFullUrl(path: string, format: string = 'image/png', cmap: string = 'viridis'): string {
  return `${API_BASE}/array/full/${path}?format=${encodeURIComponent(format)}&cmap=${cmap}`;
}

export async function fetchThumbnail(path: string, cmap: string = 'viridis', slice: number = 0): Promise<string | null> {
  try {
    const authHeader = await getValidAuthHeader();
    const url = getThumbnailUrl(path, cmap, slice);

    const response = await fetch(url, {
      headers: authHeader ? { Authorization: authHeader } : {},
    });

    if (!response.ok) return null;

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function downloadImage(path: string, filename: string): Promise<void> {
  const authHeader = await getValidAuthHeader();
  const url = getPngUrl(path);

  const response = await fetch(url, {
    headers: authHeader ? { Authorization: authHeader } : {},
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';

  // Check if we got an error response instead of image
  if (contentType.includes('application/json')) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Server returned error instead of image');
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export async function fetchArrayData(path: string): Promise<number[][]> {
  const url = `${API_BASE}/array/full/${path}?format=application/json`;
  const response = await fetchWithAuth(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch array: ${response.status}`);
  }
  return response.json();
}

// Fetch table data from tiled as JSON
export async function fetchTableData(path: string): Promise<Record<string, unknown>[]> {
  const url = `${API_BASE}/table/full/${path}?format=application/json`;
  const response = await fetchWithAuth(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch table: ${response.status}`);
  }
  return response.json();
}

// Find a reconstruction array path by matching scan_id
export async function findReconstructionByScanId(
  segmentationPath: string,
  scanId: string
): Promise<string | null> {
  // Convert path: synaps/segmentations/fxi/automap_123_xxx → synaps/reconstructions/fxi
  const pathParts = segmentationPath.split('/');
  const reconstructionsPath = pathParts.slice(0, -1).join('/').replace('/segmentations/', '/reconstructions/');

  try {
    const result = await listChildren(reconstructionsPath, { limit: 50 });
    // Find reconstruction with matching scan_id prefix
    const match = result.items.find(item => item.id.startsWith(`automap_${scanId}_`));
    if (match) {
      // Get first array child from this reconstruction
      const children = await listChildren(match.path, { limit: 10 });
      const firstArray = children.items.find(item => item.structureFamily === 'array');
      return firstArray?.path || null;
    }
  } catch (e) {
    console.warn('Failed to find reconstruction for scan', scanId, e);
  }
  return null;
}

export { TILED_URL };
