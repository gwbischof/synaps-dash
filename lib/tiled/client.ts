import { TiledSearchResponse, TiledNode, DatasetItem } from './types';
import { getAuthHeader } from './auth';

// Use local API proxy to avoid CORS issues
const API_BASE = '/api/tiled';

// Keep original URL for reference/WebSocket
const TILED_URL = process.env.NEXT_PUBLIC_TILED_URL || 'https://tiled.nsls2.bnl.gov';

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeader = getAuthHeader();

  const headers = new Headers(options.headers);
  if (authHeader) {
    headers.set('Authorization', authHeader);
  }

  return fetch(url, { ...options, headers });
}

export interface ListChildrenOptions {
  offset?: number;
  limit?: number;
  sort?: string;
}

export async function listChildren(
  path: string,
  options: ListChildrenOptions = {}
): Promise<{ items: DatasetItem[]; hasMore: boolean; totalCount: number }> {
  const { offset = 0, limit = 20, sort = '-time_created' } = options;

  // Try sort options in order of preference
  const sortOptions = sort ? [sort, '-scan_id', ''] : [''];
  let response: Response | null = null;
  let usedSort = '';

  for (const sortOption of sortOptions) {
    const url = new URL(`${API_BASE}/search/${path}`, window.location.origin);
    url.searchParams.set('page[offset]', offset.toString());
    url.searchParams.set('page[limit]', limit.toString());
    if (sortOption) {
      url.searchParams.set('sort', sortOption);
    }

    response = await fetchWithAuth(url.toString());

    if (response.ok) {
      usedSort = sortOption;
      break;
    }
  }

  if (!response || !response.ok) {
    throw new Error(`Failed to list children: ${response?.status} ${response?.statusText}`);
  }

  const data: TiledSearchResponse<TiledNode> = await response.json();

  let items: DatasetItem[] = data.data.map((node) => ({
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

  // If no sort was used, reverse to show newest first (assuming server returns oldest first)
  if (!usedSort && offset === 0) {
    items = items.reverse();
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

export function getThumbnailUrl(path: string): string {
  return `${API_BASE}/array/full/${path}?format=image/png`;
}

export function getSvgUrl(path: string): string {
  return `${API_BASE}/array/full/${path}?format=image/svg%2Bxml`;
}

export function getArrayFullUrl(path: string, format: string = 'image/png'): string {
  return `${API_BASE}/array/full/${path}?format=${encodeURIComponent(format)}`;
}

export async function fetchThumbnail(path: string): Promise<string | null> {
  try {
    const authHeader = getAuthHeader();
    const url = getThumbnailUrl(path);

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

export async function downloadSvg(path: string, filename: string): Promise<void> {
  const authHeader = getAuthHeader();
  const url = getSvgUrl(path);

  const response = await fetch(url, {
    headers: authHeader ? { Authorization: authHeader } : {},
  });

  if (!response.ok) {
    throw new Error(`Failed to download SVG: ${response.status}`);
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

export { TILED_URL };
