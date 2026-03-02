'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, BarChart3 } from 'lucide-react';
import { fetchThumbnail } from '@/lib/tiled/client';

// Viridis colormap - 256 RGB values
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

// Group colors for different segmentation groups
const GROUP_COLORS = [
  '#ff6b6b', // red
  '#4ecdc4', // teal
  '#45b7d1', // blue
  '#96ceb4', // green
  '#ffeaa7', // yellow
  '#dfe6e9', // gray
];

interface SegmentationRow {
  cx?: number;
  cy?: number;
  num_x?: number;
  num_y?: number;
  label?: string;
  // For formatted_unions with pixel coords:
  image_center?: [number, number];
  image_radius?: number;
  image_length?: number;
  text?: string;
}

interface SegmentationPlotProps {
  path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  title?: string;
}

// Convert coordinates to pixel space based on available data format
function convertToPixelCoords(
  row: SegmentationRow,
  stepSize: number,
  xStart: number,
  yStart: number
): { x: number; y: number; size: number } {
  // Format 1: Direct pixel coordinates (from formatted_unions with image_center)
  if (row.image_center) {
    const [cx, cy] = row.image_center;
    const size = row.image_length ?? (row.image_radius ? row.image_radius * 2 : 20);
    return { x: cx - size / 2, y: cy - size / 2, size };
  }

  // Format 2: Real-world coordinates with step_size conversion
  if (stepSize && stepSize > 0) {
    const numX = row.num_x || 10;
    const numY = row.num_y || 10;
    const size = ((numX + numY) / 2) / stepSize;
    const x = ((row.cx || 0) - xStart) / stepSize - size / 2;
    const y = ((row.cy || 0) - yStart) / stepSize - size / 2;
    return { x, y, size };
  }

  // Format 3: Legacy fallback (kept for compatibility)
  const numX = row.num_x || 10;
  const numY = row.num_y || 10;
  const size = 10 * (numX + numY) / 2;
  const x = ((row.cx || 0) + 10) * 10 - size / 2;
  const y = ((row.cy || 0) + 10) * 10 - size / 2;
  return { x, y, size };
}

interface GroupData {
  formatted_unions?: Record<string, SegmentationRow>;
  fine_scans_table?: Record<string, SegmentationRow> | SegmentationRow[];
}

// Extract segmentation tables from metadata
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSegmentationTables(metadata?: Record<string, any>): Record<string, SegmentationRow[]> {
  const tables: Record<string, SegmentationRow[]> = {};
  if (!metadata) return tables;

  // Method 1: Extract from groups -> fine_scans_table and formatted_unions
  if (metadata.groups) {
    for (const [groupName, groupDataRaw] of Object.entries(metadata.groups)) {
      const groupData = groupDataRaw as GroupData;

      // Check for fine_scans_table
      if (groupData.fine_scans_table) {
        const table = groupData.fine_scans_table;
        const rows = Array.isArray(table) ? table : Object.values(table);
        if (!tables[groupName]) tables[groupName] = [];
        tables[groupName].push(...(rows as SegmentationRow[]));
      }

      // Check for formatted_unions (pixel coordinates)
      if (groupData.formatted_unions) {
        if (!tables[groupName]) tables[groupName] = [];
        for (const [name, unionData] of Object.entries(groupData.formatted_unions)) {
          if (unionData.image_center || (unionData.cx !== undefined && unionData.cy !== undefined)) {
            tables[groupName].push({
              ...unionData,
              label: unionData.text || unionData.label || name,
            });
          }
        }
      }
    }
  }

  // Method 2: Extract from top-level fine_scans_tables
  if (metadata.fine_scans_tables) {
    for (const [groupName, table] of Object.entries(metadata.fine_scans_tables)) {
      const rows = Array.isArray(table) ? table : Object.values(table as object);
      if (!tables[groupName]) tables[groupName] = [];
      tables[groupName].push(...(rows as SegmentationRow[]));
    }
  }

  return tables;
}

export function SegmentationPlotButton({ path, metadata, title }: SegmentationPlotProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [plotUrl, setPlotUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const segmentationTables = extractSegmentationTables(metadata);
  const hasSegmentationData = Object.keys(segmentationTables).length > 0;

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (plotUrl) URL.revokeObjectURL(plotUrl);
    };
  }, [plotUrl]);

  const generatePlot = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // 1. Fetch the grayscale image
      const grayscaleUrl = await fetchThumbnail(path);
      if (!grayscaleUrl) {
        throw new Error('Failed to fetch image');
      }

      // 2. Load image and get dimensions
      const img = await loadImage(grayscaleUrl);
      const width = img.width;
      const height = img.height;

      // 3. Create canvas and draw colorized image with boxes
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      // Draw and colorize the image
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Apply viridis colormap
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i];
        const [r, g, b] = VIRIDIS_LUT[gray];
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }
      ctx.putImageData(imageData, 0, 0);

      // 4. Draw segmentation boxes
      // Get conversion parameters from metadata
      const stepSize = metadata?.step_size || 0;
      const xStart = metadata?.roi_positions?.x_start || 0;
      const yStart = metadata?.roi_positions?.y_start || 0;

      let colorIndex = 0;
      for (const [groupName, rows] of Object.entries(segmentationTables)) {
        const color = GROUP_COLORS[colorIndex % GROUP_COLORS.length];
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.font = 'bold 12px monospace';

        for (const row of rows) {
          const { x, y, size } = convertToPixelCoords(row, stepSize, xStart, yStart);

          // Draw rectangle
          ctx.strokeRect(x, y, size, size);

          // Draw label background
          const label = row.label || groupName;
          const labelWidth = ctx.measureText(label).width + 8;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(x, y - 16, labelWidth, 14);

          // Draw label text
          ctx.fillStyle = color;
          ctx.fillText(label, x + 4, y - 4);
        }
        colorIndex++;
      }

      // 5. Draw title
      if (title) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(8, 8, ctx.measureText(title).width + 16, 24);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(title, 16, 25);
      }

      // 6. Convert to blob URL
      URL.revokeObjectURL(grayscaleUrl);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Failed to create blob')), 'image/png');
      });

      if (plotUrl) URL.revokeObjectURL(plotUrl);
      setPlotUrl(URL.createObjectURL(blob));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate plot');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPlot = () => {
    if (!plotUrl) return;
    const link = document.createElement('a');
    link.href = plotUrl;
    link.download = `segmentation_${metadata?.scan_id || 'plot'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!hasSegmentationData) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          onClick={generatePlot}
          disabled={isGenerating}
          variant="outline"
          className="flex-1 border-nebula text-nebula hover:bg-nebula/10"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <BarChart3 className="h-4 w-4 mr-2" />
          )}
          Generate Segmentation Plot
        </Button>
      </div>

      {plotUrl && (
        <div className="space-y-2">
          <div className="rounded-lg overflow-hidden border border-border-subtle">
            <img src={plotUrl} alt="Segmentation plot" className="w-full" />
          </div>
          <Button
            onClick={downloadPlot}
            variant="outline"
            size="sm"
            className="w-full border-cell text-cell hover:bg-cell/10"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Plot
          </Button>
        </div>
      )}

      {error && (
        <p className="text-xs text-error">{error}</p>
      )}
    </div>
  );
}

// Helper to load image as promise
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}
