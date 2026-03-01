import { TiledSearchResponse, TiledNode, DatasetItem } from './types';
import { getValidAccessToken } from './auth';

// Use local API proxy to avoid CORS issues
const API_BASE = '/api/tiled';

// Keep original URL for reference/WebSocket
const TILED_URL = process.env.NEXT_PUBLIC_TILED_URL || 'https://tiled.nsls2.bnl.gov';

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken();

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
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

  const url = new URL(`${API_BASE}/search/${path}`, window.location.origin);
  url.searchParams.set('page[offset]', offset.toString());
  url.searchParams.set('page[limit]', limit.toString());
  url.searchParams.set('sort', sort);

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
    shape: node.attributes.structure?.shape,
    timeCreated: node.attributes.metadata.time_created as string | undefined,
  }));

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
    const token = await getValidAccessToken();
    const url = getThumbnailUrl(path);

    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) return null;

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function downloadSvg(path: string, filename: string): Promise<void> {
  const token = await getValidAccessToken();
  const url = getSvgUrl(path);

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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
