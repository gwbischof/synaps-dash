'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Hash, Activity } from 'lucide-react';
import {
  fetchThumbnailIfChanged,
  listChildren,
  getMetadata,
  fetchFloat32Array,
  fetchInt32Array,
  fetchFloat64Array,
} from '@/lib/tiled/client';
import { useTiledSubscription } from '@/hooks/use-tiled-subscription';
import { IncrementalStitcher, mosaicToImageData } from '@/lib/stitcher';

interface HoloptychoViewerProps {
  // Path to the run container, e.g. hxn/processed/holoptycho/{run_uid}
  path: string;
  metadata?: Record<string, unknown>;
}

interface SourceInfo {
  // Which sub-container the iterative recon lives in: 'live' or 'final', or null if absent.
  iterativeSource: 'live' | 'final' | null;
  // Whether vit/pred_latest is available.
  hasVit: boolean;
}

// Tiles poll on this cadence using If-None-Match. Most polls return 304 (cheap, ~1KB
// of headers) — only when the upstream array's bytes change does the full PNG transfer.
const POLL_INTERVAL_MS = 2000;

async function discoverSources(runPath: string): Promise<SourceInfo> {
  try {
    const children = await listChildren(runPath, { limit: 10 });
    const ids = new Set(children.items.map(c => c.id));
    const iterativeSource = ids.has('live') ? 'live' : ids.has('final') ? 'final' : null;
    return { iterativeSource, hasVit: ids.has('vit') };
  } catch {
    return { iterativeSource: null, hasVit: false };
  }
}

interface TiledImageTileProps {
  title: string;
  subtitle?: string;
  path: string;
  // Slice expression passed to tiled — e.g. 0 for (mode, H, W) or "0,1" for (B, C, H, W)
  slice: number | string;
  cmap?: string;
  // Polling cadence — set to 0/undefined to disable polling (e.g. for `final/` arrays
  // that never change after a run completes).
  pollIntervalMs?: number;
  // Called whenever a fresh image is loaded (i.e. ETag changed). Lets the parent
  // update timestamps and metadata-derived state.
  onChanged?: () => void;
}

function TiledImageTile({
  title,
  subtitle,
  path,
  slice,
  cmap = 'viridis',
  pollIntervalMs,
  onChanged,
}: TiledImageTileProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousUrlRef = useRef<string | null>(null);
  const onChangedRef = useRef(onChanged);

  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    let cancelled = false;
    let etag: string | null = null;
    let inflight = false;

    const tick = async () => {
      if (cancelled || inflight) return;
      inflight = true;
      const result = await fetchThumbnailIfChanged(path, cmap, slice, etag);
      inflight = false;
      if (cancelled) {
        if (result.status === 'changed') URL.revokeObjectURL(result.blobUrl);
        return;
      }
      if (result.status === 'changed') {
        etag = result.etag;
        if (previousUrlRef.current) URL.revokeObjectURL(previousUrlRef.current);
        previousUrlRef.current = result.blobUrl;
        setImageUrl(result.blobUrl);
        setHasLoadedOnce(true);
        setError(null);
        onChangedRef.current?.();
      } else if (result.status === 'error' && !etag) {
        // Only surface errors before we've ever loaded; transient errors during polling
        // shouldn't replace a perfectly good last frame.
        setError('Failed to load');
        setHasLoadedOnce(true);
      }
    };

    tick();
    if (!pollIntervalMs) {
      return () => { cancelled = true; };
    }
    const handle = setInterval(tick, pollIntervalMs);
    return () => { cancelled = true; clearInterval(handle); };
  }, [path, slice, cmap, pollIntervalMs]);

  // Revoke on unmount
  useEffect(() => {
    return () => {
      if (previousUrlRef.current) URL.revokeObjectURL(previousUrlRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-wider text-text-tertiary font-medium">{title}</span>
        {subtitle && <span className="text-[10px] text-text-tertiary font-mono">{subtitle}</span>}
      </div>
      <div className="relative aspect-square rounded-lg overflow-hidden bg-surface-raised border border-border-subtle">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={title} className="w-full h-full object-contain" />
        ) : null}
        {!hasLoadedOnce && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-beam animate-spin" />
          </div>
        )}
        {error && !imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-text-tertiary text-xs">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// Run-level metadata fields needed to stitch ViT predictions into a global
// mosaic. ptycho_holo.py writes these onto the run container so the
// dashboard can reproduce the scan-grid positions deterministically.
interface ScanGridMetadata {
  x_num?: number;
  y_num?: number;
  x_range_um?: number;
  y_range_um?: number;
  x_direction?: number;
  y_direction?: number;
  x_pixel_m?: number;
}

// Compute canvas bounds from the actual positions in microns. Returns null
// if no finite positions are present yet. We derive bounds from observed
// positions rather than the configured x_range_um / y_range_um because in
// practice fly-scan motor positions extend several microns past the nominal
// scan range (overshoot, settling, angle).
function computeBoundsM(positionsUm: Float64Array): {
  xMinM: number; xMaxM: number; yMinM: number; yMaxM: number;
} | null {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (let k = 0; k < positionsUm.length; k += 2) {
    const x = positionsUm[k], y = positionsUm[k + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  if (!Number.isFinite(xMin) || !Number.isFinite(yMin)) return null;
  return {
    xMinM: xMin * 1e-6,
    xMaxM: xMax * 1e-6,
    yMinM: yMin * 1e-6,
    yMaxM: yMax * 1e-6,
  };
}

function pixelSizeFromMetadata(metadata?: Record<string, unknown>): number | null {
  if (!metadata) return null;
  const m = metadata as ScanGridMetadata;
  if (typeof m.x_pixel_m !== 'number' || m.x_pixel_m <= 0) return null;
  return m.x_pixel_m;
}

interface StitchedVitTileProps {
  // Path to the run container.
  runPath: string;
  // Run-level metadata (must include scan-grid fields).
  metadata?: Record<string, unknown>;
  // Whether new batches are still expected. Set false on completed runs to
  // skip the polling fallback path.
  live: boolean;
  onChanged?: () => void;
}

function StitchedVitTile({ runPath, metadata, live, onChanged }: StitchedVitTileProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stitcherRef = useRef<IncrementalStitcher | null>(null);
  const processedRef = useRef<Set<string>>(new Set());
  const inflightRef = useRef<Set<string>>(new Set());
  const onChangedRef = useRef(onChanged);
  const [batchesProcessed, setBatchesProcessed] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  // Track the canvas bounds the current stitcher was built with, so we can
  // tell when newly-arrived positions extend past the canvas and we need to
  // rebuild.
  const boundsRef = useRef<{ xMinM: number; xMaxM: number; yMinM: number; yMaxM: number } | null>(null);

  // Reset stitcher state whenever we switch runs.
  useEffect(() => {
    const ps = pixelSizeFromMetadata(metadata);
    if (!ps) {
      stitcherRef.current = null;
      processedRef.current = new Set();
      boundsRef.current = null;
      setError('Run is missing scan-grid metadata; can\'t stitch.');
      return;
    }
    stitcherRef.current = null;
    processedRef.current = new Set();
    inflightRef.current = new Set();
    boundsRef.current = null;
    setBatchesProcessed(0);
    setHasLoadedOnce(false);
    setError(null);
  }, [runPath, metadata]);

  const renderMosaic = useCallback(() => {
    const stitcher = stitcherRef.current;
    const canvas = canvasRef.current;
    if (!stitcher || !canvas) return;
    const mosaic = stitcher.getMosaic();
    if (!mosaic) return;
    if (canvas.width !== mosaic.width || canvas.height !== mosaic.height) {
      canvas.width = mosaic.width;
      canvas.height = mosaic.height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(mosaicToImageData(mosaic), 0, 0);
    setHasLoadedOnce(true);
    onChangedRef.current?.();
  }, []);

  // Fetch any batch we haven't seen yet. Safe to call concurrently — we
  // dedupe via processedRef + inflightRef.
  const ingestBatch = useCallback(async (batchPath: string, batchId: string) => {
    if (processedRef.current.has(batchId) || inflightRef.current.has(batchId)) return;
    if (!stitcherRef.current) return;
    inflightRef.current.add(batchId);
    try {
      const [{ data: pred, shape }, { data: indices }] = await Promise.all([
        fetchFloat32Array(`${batchPath}/pred`),
        fetchInt32Array(`${batchPath}/indices`),
      ]);
      if (!stitcherRef.current) return;
      stitcherRef.current.addBatch(pred, indices, shape);
      processedRef.current.add(batchId);
      setBatchesProcessed(processedRef.current.size);
      renderMosaic();
    } catch {
      // Transient — caller will retry on next poll.
    } finally {
      inflightRef.current.delete(batchId);
    }
  }, [renderMosaic]);

  // Initial load + live polling: refresh positions, list all existing
  // batches, ingest any we haven't seen yet. Constructs the stitcher on the
  // first tick once positions_um is available.
  const batchesPath = `${runPath}/vit/batches`;
  const positionsPath = `${runPath}/positions_um`;
  useEffect(() => {
    const pixelSizeM = pixelSizeFromMetadata(metadata);
    if (!pixelSizeM) return;
    let cancelled = false;
    const tick = async () => {
      try {
        // Always refresh positions so newly-arrived frames have real
        // positions before their batch lands. Stitcher carries NaNs over
        // until the PandA stream catches up.
        let positionsUm: Float64Array | null = null;
        try {
          const fetched = await fetchFloat64Array(positionsPath);
          positionsUm = fetched.data;
        } catch {
          // positions_um doesn't exist yet on this run (the pipeline writes
          // it on the first ViT batch). Nothing to do until a batch lands.
          return;
        }
        if (cancelled) return;
        const observed = computeBoundsM(positionsUm);
        if (!observed) return; // no finite positions yet
        // Pad observed bounds so newly-arriving rows of a snake/raster scan
        // don't immediately push us past the canvas.
        const margin = 0.5e-6;
        const wantedBounds = {
          xMinM: observed.xMinM - margin,
          xMaxM: observed.xMaxM + margin,
          yMinM: observed.yMinM - margin,
          yMaxM: observed.yMaxM + margin,
        };
        const cur = boundsRef.current;
        const existing = stitcherRef.current;
        const needsRebuild = !existing
          || !cur
          || wantedBounds.xMinM < cur.xMinM
          || wantedBounds.xMaxM > cur.xMaxM
          || wantedBounds.yMinM < cur.yMinM
          || wantedBounds.yMaxM > cur.yMaxM;
        if (needsRebuild) {
          stitcherRef.current = new IncrementalStitcher({
            positionsUm,
            pixelSizeM,
            ...wantedBounds,
          });
          boundsRef.current = wantedBounds;
          // Force re-ingest of every batch so the new (larger) canvas gets
          // populated with all batches we've already seen.
          processedRef.current = new Set();
          setBatchesProcessed(0);
        } else {
          existing.updatePositions(positionsUm);
        }

        // Empty sort overrides listChildren's default '-_', which the
        // synaps_project container spec rejects with 422 for batch containers.
        // Sort client-side instead — keys are zero-padded ('000000', '000001'…)
        // so lexical ordering matches numeric. Paginate because tiled caps
        // page[limit] at 300.
        const all = [];
        let offset = 0;
        while (true) {
          const result = await listChildren(batchesPath, { limit: 300, offset, sort: '' });
          if (cancelled) return;
          all.push(...result.items);
          if (!result.hasMore) break;
          offset += result.items.length;
          if (result.items.length === 0) break;
        }
        const items = all.sort((a, b) => a.id.localeCompare(b.id));
        for (const item of items) {
          if (cancelled) return;
          await ingestBatch(item.path, item.id);
        }
      } catch {
        // Transient
      }
    };
    tick();
    if (!live) return () => { cancelled = true; };
    const handle = setInterval(tick, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(handle); };
  }, [batchesPath, positionsPath, metadata, ingestBatch, live]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live updates: WebSocket fires when a new batch container appears.
  const handleNewBatch = useCallback((item: { id: string; path: string }) => {
    void ingestBatch(item.path, item.id);
  }, [ingestBatch]);
  useTiledSubscription(batchesPath, handleNewBatch, { enabled: live });

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-wider text-text-tertiary font-medium">
          ViT mosaic (phase)
        </span>
        <span className="text-[10px] text-text-tertiary font-mono">
          {batchesProcessed > 0 ? `${batchesProcessed} batch${batchesProcessed === 1 ? '' : 'es'}` : ''}
        </span>
      </div>
      <div className="relative aspect-square rounded-lg overflow-hidden bg-surface-raised border border-border-subtle">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
        {!hasLoadedOnce && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-beam animate-spin" />
          </div>
        )}
        {error && !hasLoadedOnce && (
          <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-text-tertiary text-xs">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export function HoloptychoViewer({ path, metadata }: HoloptychoViewerProps) {
  const [sources, setSources] = useState<SourceInfo>({ iterativeSource: null, hasVit: false });
  const [isDiscovering, setIsDiscovering] = useState(true);
  const [iteration, setIteration] = useState<number | null>(null);
  // Wall-clock time of the most recent refresh — drives the "updated Xs ago" indicator.
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  // Forces the relative-time string to recompute every second so the indicator ticks up.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const handle = setInterval(() => setNowTick(t => t + 1), 1000);
    return () => clearInterval(handle);
  }, []);

  const containerMeta = metadata as { scan_id?: number | string; recon_mode?: string; run_uid?: string } | undefined;

  // Initial discovery: figure out which sub-containers exist on this run.
  useEffect(() => {
    let cancelled = false;
    setIsDiscovering(true);
    discoverSources(path).then(result => {
      if (cancelled) return;
      setSources(result);
      setIsDiscovering(false);
    });
    return () => { cancelled = true; };
  }, [path]);

  // WebSocket subscription on the run container picks up newly-created sub-containers
  // (e.g. live/ appears partway through a run). We re-run discovery on creation.
  const handleNewItem = useCallback(() => {
    discoverSources(path).then(setSources);
  }, [path]);
  useTiledSubscription(path, handleNewItem, { enabled: true });

  // Each tile's onChanged fires when it loads a fresh image (ETag changed). We use it
  // to refresh the iteration/batch_num counters and stamp the "updated Xs ago" footer.
  const handleObjectChanged = useCallback(() => {
    setLastUpdateAt(Date.now());
    if (!sources.iterativeSource) return;
    getMetadata(`${path}/${sources.iterativeSource}/object`)
      .then(m => {
        const it = (m as { iteration?: number }).iteration;
        if (typeof it === 'number') setIteration(it);
      })
      .catch(() => { /* ignore */ });
  }, [path, sources.iterativeSource]);

  const handleProbeChanged = useCallback(() => {
    setLastUpdateAt(Date.now());
  }, []);

  const handleVitChanged = useCallback(() => {
    setLastUpdateAt(Date.now());
  }, []);

  if (isDiscovering) {
    return (
      <div className="flex items-center justify-center h-64 rounded-xl bg-surface-raised border border-border-subtle">
        <Loader2 className="w-5 h-5 text-beam animate-spin" />
      </div>
    );
  }

  if (!sources.iterativeSource && !sources.hasVit) {
    return (
      <div className="flex items-center justify-center h-32 rounded-xl bg-surface-raised border border-border-subtle">
        <span className="text-sm text-text-tertiary">Run has no live/, final/, or vit/ data yet</span>
      </div>
    );
  }

  const objectPath = sources.iterativeSource ? `${path}/${sources.iterativeSource}/object` : '';
  const probePath = sources.iterativeSource ? `${path}/${sources.iterativeSource}/probe` : '';

  // `final/` arrays don't change after the run completes — no polling needed.
  const iterativePollMs = sources.iterativeSource === 'live' ? POLL_INTERVAL_MS : 0;
  // Treat ViT as live whenever the iterative side is live, or whenever the run
  // is ViT-only (no iterative source at all).
  const vitLive = sources.iterativeSource === 'live' || !sources.iterativeSource;

  // Format last-update time as a short relative string for the footer.
  const formatRelative = (ts: number | null): string => {
    if (ts === null) return '—';
    const dt = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (dt < 1) return 'just now';
    if (dt < 60) return `${dt}s ago`;
    const m = Math.floor(dt / 60);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {objectPath && (
          <TiledImageTile
            title={`${sources.iterativeSource === 'live' ? 'Iterative' : 'Final'} object |·|`}
            subtitle={iteration !== null ? `iter ${iteration}` : undefined}
            path={objectPath}
            slice={0}
            pollIntervalMs={iterativePollMs}
            onChanged={handleObjectChanged}
          />
        )}
        {sources.hasVit && (
          <StitchedVitTile
            runPath={path}
            metadata={metadata}
            live={vitLive}
            onChanged={handleVitChanged}
          />
        )}
        {probePath && (
          <TiledImageTile
            title="Probe |·|"
            path={probePath}
            slice={0}
            pollIntervalMs={iterativePollMs}
            onChanged={handleProbeChanged}
          />
        )}
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-raised/50 border border-border-subtle text-[11px] font-mono">
        {containerMeta?.scan_id !== undefined && (
          <span className="flex items-center gap-1 text-text-secondary">
            <Hash className="w-3 h-3 text-beam" />
            {containerMeta.scan_id}
          </span>
        )}
        {containerMeta?.recon_mode && (
          <span className="flex items-center gap-1 text-text-secondary">
            <Activity className="w-3 h-3 text-cell" />
            {containerMeta.recon_mode}
          </span>
        )}
        {sources.iterativeSource === 'live' && (
          <span className="ml-auto text-text-tertiary">
            updated {formatRelative(lastUpdateAt)}
          </span>
        )}
        {sources.iterativeSource === 'final' && (
          <span className="ml-auto text-text-tertiary">final</span>
        )}
      </div>
    </div>
  );
}
