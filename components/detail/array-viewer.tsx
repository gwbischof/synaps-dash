'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchThumbnail } from '@/lib/tiled/client';

// Viridis colormap stops for colorbar SVG
const VIRIDIS_STOPS = [
  { offset: 0, color: '#440154' },
  { offset: 0.25, color: '#3b528b' },
  { offset: 0.5, color: '#21918c' },
  { offset: 0.75, color: '#5ec962' },
  { offset: 1, color: '#fde725' },
];

// Full Viridis colormap - 256 RGB values for Canvas colormapping
const VIRIDIS_LUT: [number, number, number][] = [
  [68,1,84],[68,2,86],[69,4,87],[69,5,89],[70,7,90],[70,8,92],[70,10,93],[70,11,94],
  [71,13,96],[71,14,97],[71,16,99],[71,17,100],[71,19,101],[72,20,103],[72,22,104],[72,23,105],
  [72,24,106],[72,26,108],[72,27,109],[72,28,110],[72,29,111],[72,31,112],[72,32,113],[72,33,115],
  [72,35,116],[72,36,117],[72,37,118],[72,38,119],[72,40,120],[72,41,121],[71,42,122],[71,44,122],
  [71,45,123],[71,46,124],[71,47,125],[70,48,126],[70,50,126],[70,51,127],[69,52,128],[69,53,129],
  [69,55,129],[68,56,130],[68,57,131],[68,58,131],[67,60,132],[67,61,132],[66,62,133],[66,63,133],
  [66,64,134],[65,66,134],[65,67,135],[64,68,135],[64,69,136],[63,71,136],[63,72,137],[62,73,137],
  [62,74,137],[62,76,138],[61,77,138],[61,78,138],[60,79,139],[60,80,139],[59,81,139],[59,82,139],
  [58,83,140],[58,84,140],[57,85,140],[57,86,140],[56,88,140],[56,89,141],[55,90,141],[55,91,141],
  [54,92,141],[54,93,141],[53,94,141],[53,95,142],[52,96,142],[52,97,142],[51,98,142],[51,99,142],
  [50,100,142],[50,101,142],[49,102,142],[49,103,142],[49,104,142],[48,105,142],[48,106,142],[47,107,142],
  [47,108,142],[46,109,142],[46,110,142],[45,111,142],[45,112,142],[44,113,142],[44,114,142],[44,115,142],
  [43,116,142],[43,117,142],[42,118,142],[42,119,142],[41,120,142],[41,121,142],[40,122,142],[40,122,142],
  [40,123,142],[39,124,142],[39,125,142],[38,126,142],[38,127,142],[37,128,142],[37,129,142],[36,130,142],
  [36,131,141],[35,132,141],[35,133,141],[35,134,141],[34,135,141],[34,136,141],[33,137,141],[33,138,141],
  [32,139,141],[32,140,140],[32,141,140],[31,142,140],[31,143,140],[30,144,140],[30,145,139],[30,146,139],
  [29,147,139],[29,148,139],[29,149,139],[28,150,138],[28,151,138],[28,152,138],[27,153,138],[27,154,137],
  [27,155,137],[27,156,137],[26,157,136],[26,158,136],[26,159,136],[26,160,135],[26,161,135],[25,162,135],
  [25,163,134],[25,164,134],[25,165,134],[25,166,133],[25,167,133],[25,168,132],[25,169,132],[26,170,131],
  [26,171,131],[26,172,130],[26,173,130],[27,174,129],[27,175,129],[27,176,128],[28,177,128],[28,178,127],
  [29,179,127],[29,180,126],[30,181,125],[30,182,125],[31,183,124],[32,184,124],[32,185,123],[33,186,122],
  [34,187,122],[35,188,121],[35,189,120],[36,190,120],[37,191,119],[38,192,118],[39,193,118],[40,194,117],
  [41,195,116],[42,196,115],[44,197,115],[45,198,114],[46,199,113],[47,200,112],[49,201,111],[50,202,110],
  [52,203,110],[53,204,109],[55,205,108],[56,206,107],[58,207,106],[60,208,105],[61,209,104],[63,210,103],
  [65,210,102],[67,211,101],[69,212,100],[71,213,99],[73,214,98],[75,215,97],[77,215,96],[79,216,95],
  [81,217,93],[83,218,92],[86,218,91],[88,219,90],[90,220,88],[92,221,87],[95,221,86],[97,222,84],
  [99,223,83],[102,223,82],[104,224,80],[107,225,79],[109,225,78],[112,226,76],[114,227,75],[117,227,73],
  [119,228,72],[122,228,71],[125,229,69],[127,229,68],[130,230,66],[133,230,65],[135,231,63],[138,231,62],
  [141,232,60],[143,232,59],[146,233,57],[149,233,56],[152,234,54],[154,234,53],[157,234,51],[160,235,50],
  [163,235,48],[166,236,47],[168,236,45],[171,236,44],[174,237,42],[177,237,41],[180,238,39],[182,238,38],
  [185,238,36],[188,239,35],[191,239,34],[193,239,32],[196,240,31],[199,240,30],[201,240,29],[204,241,27],
  [207,241,26],[209,241,25],[212,242,24],[215,242,24],[217,242,23],[220,243,22],[222,243,22],[225,243,21],
];

// Apply Viridis colormap to a grayscale image using Canvas
async function applyColormapToImage(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Apply colormap
      for (let i = 0; i < data.length; i += 4) {
        // Use red channel as grayscale value (R=G=B for grayscale)
        const gray = data[i];
        const [r, g, b] = VIRIDIS_LUT[gray];
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        // Alpha stays the same
      }

      // Put colorized data back
      ctx.putImageData(imageData, 0, 0);

      // Convert to blob URL
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/png');
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  showScalebar?: boolean;
  showColorbar?: boolean;
  scalebarUnit?: 'µm' | 'nm';
  colormap?: 'viridis' | 'grayscale';
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBoundingBoxes(metadata?: Record<string, any>): BoundingBox[] {
  const boxes: BoundingBox[] = [];
  if (!metadata) return boxes;

  const stepSize = metadata.step_size || 1;
  const xStart = metadata.roi_positions?.x_start || 0;
  const yStart = metadata.roi_positions?.y_start || 0;

  let colorIndex = 0;

  // Method 1: Extract from groups -> formatted_unions (pixel coordinates)
  if (metadata.groups) {
    for (const [groupName, groupDataRaw] of Object.entries(metadata.groups)) {
      const groupData = groupDataRaw as GroupData;
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
    for (const [groupName, tableRaw] of Object.entries(metadata.fine_scans_tables)) {
      const table = tableRaw as Record<string, FineScansTableRow> | FineScansTableRow[];
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

// Calculate a nice scalebar length (rounds to 1, 2, 5, 10, 20, 50, etc.)
function calculateScalebarLength(imageWidthUnits: number): number {
  const targetLength = imageWidthUnits * 0.2; // ~20% of image width
  const magnitude = Math.pow(10, Math.floor(Math.log10(targetLength)));
  const normalized = targetLength / magnitude;

  let nice: number;
  if (normalized < 1.5) nice = 1;
  else if (normalized < 3.5) nice = 2;
  else if (normalized < 7.5) nice = 5;
  else nice = 10;

  return nice * magnitude;
}

export function ArrayViewer({
  path,
  metadata,
  showScalebar = true,
  showColorbar = true,
  scalebarUnit = 'µm',
  colormap = 'viridis',
}: ArrayViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const boundingBoxes = extractBoundingBoxes(metadata);

  // Extract metadata values
  const stepSize = metadata?.step_size || 0.02; // default 20nm = 0.02µm
  const element = metadata?.element;
  const scanId = metadata?.scan_id;

  useEffect(() => {
    let cancelled = false;
    let currentUrl: string | null = null;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch grayscale image from Tiled
        const grayscaleUrl = await fetchThumbnail(path);
        if (cancelled || !grayscaleUrl) return;

        // Apply colormap if requested
        if (colormap === 'viridis') {
          const colorizedUrl = await applyColormapToImage(grayscaleUrl);
          // Revoke the grayscale URL since we don't need it anymore
          URL.revokeObjectURL(grayscaleUrl);
          currentUrl = colorizedUrl;
        } else {
          currentUrl = grayscaleUrl;
        }

        if (!cancelled) setImageUrl(currentUrl);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load image');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [path, colormap]);

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

  // Calculate scalebar dimensions
  const imageWidthUnits = imageDimensions
    ? imageDimensions.width * (scalebarUnit === 'nm' ? stepSize * 1000 : stepSize)
    : 0;
  const scalebarLength = calculateScalebarLength(imageWidthUnits);
  const scalebarPixels = imageDimensions
    ? scalebarLength / (scalebarUnit === 'nm' ? stepSize * 1000 : stepSize)
    : 0;

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl overflow-hidden border border-border-subtle bg-surface-ground"
    >
      <div className="flex">
        {/* Main image container */}
        <div className="relative flex-1">
          <img
            src={imageUrl}
            alt="Array visualization"
            className="w-full h-auto max-h-96 object-contain"
            onLoad={handleImageLoad}
          />

          {/* SVG overlay for bounding boxes, scalebar, and title */}
          {imageDimensions && (
            <svg
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Bounding boxes */}
              {boundingBoxes.map((box, idx) => (
                <g key={idx}>
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                    fill="none"
                    stroke={box.color}
                    strokeWidth={Math.max(1, 2 / scale)}
                  />
                  <rect
                    x={box.x}
                    y={box.y - 14 / scale}
                    width={Math.max(box.name.length * 5.5 / scale + 6 / scale, 30 / scale)}
                    height={12 / scale}
                    fill="rgba(0, 0, 0, 0.75)"
                    rx={2 / scale}
                  />
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

              {/* Scalebar - bottom right */}
              {showScalebar && scalebarPixels > 0 && (
                <g>
                  {/* Scalebar background */}
                  <rect
                    x={imageDimensions.width - scalebarPixels - 20}
                    y={imageDimensions.height - 35}
                    width={scalebarPixels + 10}
                    height={25}
                    fill="rgba(0, 0, 0, 0.6)"
                    rx={4}
                  />
                  {/* Scalebar bar */}
                  <rect
                    x={imageDimensions.width - scalebarPixels - 15}
                    y={imageDimensions.height - 18}
                    width={scalebarPixels}
                    height={4}
                    fill="white"
                  />
                  {/* Scalebar label */}
                  <text
                    x={imageDimensions.width - scalebarPixels / 2 - 15}
                    y={imageDimensions.height - 22}
                    fill="white"
                    fontSize={10}
                    fontFamily="ui-monospace, monospace"
                    fontWeight="500"
                    textAnchor="middle"
                  >
                    {scalebarLength < 1 ? scalebarLength.toFixed(2) : scalebarLength} {scalebarUnit}
                  </text>
                </g>
              )}

              {/* Title - top left */}
              {(element || scanId) && (
                <g>
                  <rect
                    x={8}
                    y={8}
                    width={Math.max((element?.length || 0) * 10 + (scanId ? 80 : 0), 60)}
                    height={24}
                    fill="rgba(0, 0, 0, 0.6)"
                    rx={4}
                  />
                  <text
                    x={16}
                    y={25}
                    fill="white"
                    fontSize={14}
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                    fontWeight="600"
                  >
                    {element}{element && scanId ? ' - ' : ''}{scanId ? `Scan ${scanId}` : ''}
                  </text>
                </g>
              )}
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

        {/* Colorbar - right side */}
        {showColorbar && imageDimensions && (
          <div className="w-12 flex flex-col items-center justify-center py-4 px-2">
            <svg width="24" height="200" className="flex-shrink-0">
              <defs>
                <linearGradient id="viridis-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
                  {VIRIDIS_STOPS.map((stop) => (
                    <stop key={stop.offset} offset={`${stop.offset * 100}%`} stopColor={stop.color} />
                  ))}
                </linearGradient>
              </defs>
              {/* Colorbar rectangle */}
              <rect
                x={4}
                y={10}
                width={16}
                height={180}
                fill="url(#viridis-gradient)"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={1}
                rx={2}
              />
              {/* Tick marks and labels */}
              <text x={12} y={8} fill="currentColor" fontSize={8} textAnchor="middle" className="text-text-secondary">High</text>
              <text x={12} y={198} fill="currentColor" fontSize={8} textAnchor="middle" className="text-text-secondary">Low</text>
            </svg>
            {element && (
              <div className="text-[10px] text-text-tertiary mt-2 text-center writing-mode-vertical" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                {element} Intensity
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
