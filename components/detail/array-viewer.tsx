'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchThumbnail } from '@/lib/tiled/client';

interface BoundingBox {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  groupName?: string;
}

interface FormattedUnion {
  image_center?: [number, number];
  image_radius?: number;
  image_length?: number;
  cx?: number;
  cy?: number;
  num_x?: number;
  num_y?: number;
  color?: string;
  text?: string;
  label?: string;
}

interface FineScansTableRow {
  cx: number;
  cy: number;
  num_x: number;
  num_y: number;
  label?: string;
  color?: string;
}

interface GroupData {
  formatted_unions?: Record<string, FormattedUnion>;
  fine_scans_table?: Record<string, FineScansTableRow> | FineScansTableRow[];
}

interface ArrayViewerProps {
  path: string;
  metadata?: {
    groups?: Record<string, GroupData>;
    fine_scans_tables?: Record<string, Record<string, FineScansTableRow> | FineScansTableRow[]>;
    step_size?: number;
    roi_positions?: {
      x_start?: number;
      y_start?: number;
    };
  };
}

// Color palette for different groups - cosmic theme
const GROUP_COLORS = [
  '#2dd4bf', // beam (teal)
  '#a78bfa', // cell (purple)
  '#60a5fa', // data (blue)
  '#f472b6', // nova (pink)
  '#4ade80', // live (green)
  '#fbbf24', // warning (gold)
];

// Extract bounding boxes from metadata
function extractBoundingBoxes(metadata?: ArrayViewerProps['metadata']): BoundingBox[] {
  const boxes: BoundingBox[] = [];
  if (!metadata) return boxes;

  const stepSize = metadata.step_size || 1;
  const xStart = metadata.roi_positions?.x_start || 0;
  const yStart = metadata.roi_positions?.y_start || 0;

  let colorIndex = 0;

  // Method 1: Extract from groups -> formatted_unions (pixel coordinates)
  if (metadata.groups) {
    for (const [groupName, groupData] of Object.entries(metadata.groups)) {
      const color = GROUP_COLORS[colorIndex % GROUP_COLORS.length];

      // Check for formatted_unions with image_center (pixel coords)
      if (groupData.formatted_unions) {
        for (const [name, union] of Object.entries(groupData.formatted_unions)) {
          if (union.image_center) {
            // Pixel coordinates - use directly
            const [cx, cy] = union.image_center;
            const size = union.image_length ?? (union.image_radius ? union.image_radius * 2 : 20);

            boxes.push({
              name: union.text || union.label || name,
              x: cx - size / 2,
              y: cy - size / 2,
              width: size,
              height: size,
              color,
              groupName,
            });
          } else if (union.cx !== undefined && union.cy !== undefined) {
            // Real-world coordinates - need conversion
            const numX = union.num_x || 10;
            const numY = union.num_y || 10;
            const size = ((numX + numY) / 2) / stepSize;
            const x = (union.cx - xStart) / stepSize - size / 2;
            const y = (union.cy - yStart) / stepSize - size / 2;

            boxes.push({
              name: union.text || union.label || name,
              x,
              y,
              width: size,
              height: size,
              color,
              groupName,
            });
          }
        }
      }

      // Check for fine_scans_table (table format from PR)
      if (groupData.fine_scans_table) {
        const table = groupData.fine_scans_table;
        const rows = Array.isArray(table) ? table : Object.values(table);

        for (const row of rows) {
          if (row.cx !== undefined && row.cy !== undefined) {
            const numX = row.num_x || 10;
            const numY = row.num_y || 10;
            const size = ((numX + numY) / 2) / stepSize;
            const x = (row.cx - xStart) / stepSize - size / 2;
            const y = (row.cy - yStart) / stepSize - size / 2;

            boxes.push({
              name: row.label || `${groupName} region`,
              x,
              y,
              width: size,
              height: size,
              color,
              groupName,
            });
          }
        }
      }

      colorIndex++;
    }
  }

  // Method 2: Extract from top-level fine_scans_tables
  if (metadata.fine_scans_tables) {
    for (const [groupName, table] of Object.entries(metadata.fine_scans_tables)) {
      const color = GROUP_COLORS[colorIndex % GROUP_COLORS.length];
      const rows = Array.isArray(table) ? table : Object.values(table);

      for (const row of rows) {
        if (row.cx !== undefined && row.cy !== undefined) {
          const numX = row.num_x || 10;
          const numY = row.num_y || 10;
          const size = ((numX + numY) / 2) / stepSize;
          const x = (row.cx - xStart) / stepSize - size / 2;
          const y = (row.cy - yStart) / stepSize - size / 2;

          boxes.push({
            name: row.label || `${groupName} region`,
            x,
            y,
            width: size,
            height: size,
            color,
            groupName,
          });
        }
      }
      colorIndex++;
    }
  }

  return boxes;
}

export function ArrayViewer({ path, metadata }: ArrayViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const boundingBoxes = extractBoundingBoxes(metadata);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const url = await fetchThumbnail(path);
        if (!cancelled) setImageUrl(url);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load image');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [path]);

  // Track container width for scaling
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 rounded-xl bg-surface-raised border border-border-subtle">
        <div className="text-center">
          <Loader2 className="h-6 w-6 text-beam animate-spin mx-auto mb-2" />
          <p className="text-xs text-text-tertiary">Loading image...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 rounded-xl bg-surface-raised border border-border-subtle">
        <div className="text-center p-6">
          <p className="text-error text-sm font-medium mb-1">Failed to load image</p>
          <p className="text-text-tertiary text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="flex items-center justify-center h-64 rounded-xl bg-surface-raised border border-border-subtle">
        <p className="text-text-tertiary text-sm">No image available</p>
      </div>
    );
  }

  // Calculate scale factor for bounding boxes
  const scale = imageDimensions && containerWidth > 0
    ? containerWidth / imageDimensions.width
    : 1;

  // Get unique group names for legend
  const groupNames = [...new Set(boundingBoxes.map(b => b.groupName).filter(Boolean))];

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl overflow-hidden border border-border-subtle bg-surface-ground"
    >
      <img
        src={imageUrl}
        alt="Array visualization"
        className="w-full h-auto max-h-96 object-contain"
        onLoad={handleImageLoad}
      />

      {/* Bounding box overlay */}
      {imageDimensions && boundingBoxes.length > 0 && (
        <svg
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {boundingBoxes.map((box, idx) => (
            <g key={idx}>
              {/* Bounding box */}
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill="none"
                stroke={box.color}
                strokeWidth={Math.max(1, 2 / scale)}
              />
              {/* Label background */}
              <rect
                x={box.x}
                y={box.y - 14 / scale}
                width={Math.max(box.name.length * 5.5 / scale + 6 / scale, 30 / scale)}
                height={12 / scale}
                fill="rgba(0, 0, 0, 0.75)"
                rx={2 / scale}
              />
              {/* Label text */}
              <text
                x={box.x + 3 / scale}
                y={box.y - 4 / scale}
                fill={box.color}
                fontSize={9 / scale}
                fontFamily="ui-monospace, monospace"
                fontWeight="600"
              >
                {box.name}
              </text>
            </g>
          ))}
        </svg>
      )}

      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-surface-ground/30 via-transparent to-transparent" />

      {/* Legend and count indicator */}
      {boundingBoxes.length > 0 && (
        <div className="absolute top-2 right-2 px-2 py-1.5 rounded-md bg-surface-ground/90 backdrop-blur-sm border border-border-subtle">
          <div className="text-xs font-mono text-text-secondary mb-1">
            {boundingBoxes.length} region{boundingBoxes.length !== 1 ? 's' : ''} detected
          </div>
          {groupNames.length > 1 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {groupNames.map((name, i) => (
                <div key={name} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-sm"
                    style={{ backgroundColor: GROUP_COLORS[i % GROUP_COLORS.length] }}
                  />
                  <span className="text-[10px] text-text-tertiary">{name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
