'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Hash, Activity, Wifi, WifiOff } from 'lucide-react';
import { fetchThumbnail, listChildren, getMetadata } from '@/lib/tiled/client';
import { useTiledSubscription } from '@/hooks/use-tiled-subscription';

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

// Polling interval used when WebSocket isn't available. Matches the reference viewer (~1s).
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
  // Path to the array
  path: string;
  // Slice expression passed to tiled — e.g. 0 for (mode, H, W) or "0,1" for (B, C, H, W)
  slice: number | string;
  // Cache-bust counter to force refetch on live updates
  version: number;
  // Optional cmap parameter (tiled may ignore for complex arrays)
  cmap?: string;
}

function TiledImageTile({ title, subtitle, path, slice, version, cmap = 'viridis' }: TiledImageTileProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchThumbnail(path, cmap, slice)
      .then(url => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (!url) {
          setError('Failed to load');
          setIsLoading(false);
          return;
        }
        // Revoke the previous blob URL on successful refresh.
        if (previousUrlRef.current) URL.revokeObjectURL(previousUrlRef.current);
        previousUrlRef.current = url;
        setImageUrl(url);
        setIsLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [path, slice, version, cmap]);

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
          // Keep the previous frame visible while a new one is fetching to avoid flicker.
          <img src={imageUrl} alt={title} className="w-full h-full object-contain" />
        ) : null}
        {!imageUrl && !isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-text-tertiary text-xs">
            no data yet
          </div>
        )}
        {error && !imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-text-tertiary text-xs">
            {error}
          </div>
        )}
        {isLoading && !imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-beam animate-spin" />
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
  const [vitBatchNum, setVitBatchNum] = useState<number | null>(null);
  // Bumped every time we see an update for live/object|probe — forces tiles to refetch.
  const [iterativeVersion, setIterativeVersion] = useState(0);
  const [vitVersion, setVitVersion] = useState(0);

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

  // Read iteration / batch_num from array metadata so the footer reflects current state.
  // Refreshed on each version bump — that's how live updates surface in tiled.
  useEffect(() => {
    if (!sources.iterativeSource) return;
    let cancelled = false;
    getMetadata(`${path}/${sources.iterativeSource}/object`)
      .then(m => {
        if (cancelled) return;
        const it = (m as { iteration?: number }).iteration;
        if (typeof it === 'number') setIteration(it);
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [path, sources.iterativeSource, iterativeVersion]);

  useEffect(() => {
    if (!sources.hasVit) return;
    let cancelled = false;
    getMetadata(`${path}/vit/pred_latest`)
      .then(m => {
        if (cancelled) return;
        const b = (m as { batch_num?: number }).batch_num;
        if (typeof b === 'number') setVitBatchNum(b);
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [path, sources.hasVit, vitVersion]);

  // WebSocket subscription on the run container picks up newly-created sub-containers
  // (e.g. live/ appears partway through a run). We re-run discovery on creation.
  const handleNewItem = useCallback(() => {
    discoverSources(path).then(setSources);
  }, [path]);

  const { mode: runMode } = useTiledSubscription(path, handleNewItem, { enabled: true });

  // Subscriptions on each sub-container — listen for metadata-updated events
  // when probe/object/pred_latest get rewritten in place.
  const handleLiveUpdate = useCallback((update: { key: string }) => {
    if (update.key === 'object' || update.key === 'probe') {
      setIterativeVersion(v => v + 1);
    }
  }, []);
  const handleFinalUpdate = useCallback((update: { key: string }) => {
    if (update.key === 'object' || update.key === 'probe') {
      setIterativeVersion(v => v + 1);
    }
  }, []);
  const handleVitUpdate = useCallback((update: { key: string }) => {
    if (update.key === 'pred_latest') {
      setVitVersion(v => v + 1);
    }
  }, []);

  const livePath = sources.iterativeSource === 'live' ? `${path}/live` : '';
  const finalPath = sources.iterativeSource === 'final' ? `${path}/final` : '';
  const vitPath = sources.hasVit ? `${path}/vit` : '';

  const { mode: liveMode } = useTiledSubscription(
    livePath,
    () => { /* no-op: we care about updates */ },
    { enabled: !!livePath, onItemUpdated: handleLiveUpdate }
  );
  useTiledSubscription(
    finalPath,
    () => { /* no-op */ },
    { enabled: !!finalPath, onItemUpdated: handleFinalUpdate }
  );
  useTiledSubscription(
    vitPath,
    () => { /* no-op */ },
    { enabled: !!vitPath, onItemUpdated: handleVitUpdate }
  );

  // Polling fallback: if WS for the live sub-container can't deliver metadata-updated events,
  // poll the array's iteration field. Only active when iterative source is `live` (final/ never changes).
  useEffect(() => {
    if (sources.iterativeSource !== 'live') return;
    let cancelled = false;
    let lastIteration = iteration;
    const tick = async () => {
      try {
        const m = await getMetadata(`${path}/live/object`);
        const it = (m as { iteration?: number }).iteration;
        if (typeof it === 'number' && it !== lastIteration) {
          lastIteration = it;
          if (!cancelled) {
            setIteration(it);
            setIterativeVersion(v => v + 1);
          }
        }
      } catch { /* ignore */ }
    };
    const handle = setInterval(tick, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(handle); };
    // We deliberately omit `iteration` from deps — the closure tracks lastIteration locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, sources.iterativeSource]);

  const objectPath = sources.iterativeSource ? `${path}/${sources.iterativeSource}/object` : '';
  const probePath = sources.iterativeSource ? `${path}/${sources.iterativeSource}/probe` : '';
  const vitPredPath = sources.hasVit ? `${path}/vit/pred_latest` : '';

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

  // Live indicator: WS active on the live sub-container means we'll get pushed updates.
  const isStreaming = liveMode === 'websocket' && sources.iterativeSource === 'live';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {objectPath && (
          <TiledImageTile
            title={`${sources.iterativeSource === 'live' ? 'Iterative' : 'Final'} object |·|`}
            subtitle={iteration !== null ? `iter ${iteration}` : undefined}
            path={objectPath}
            slice={0}
            version={iterativeVersion}
          />
        )}
        {vitPredPath && (
          <TiledImageTile
            title="ViT pred (phase, batch[0])"
            subtitle={vitBatchNum !== null ? `batch ${vitBatchNum}` : undefined}
            path={vitPredPath}
            slice="0,1"
            version={vitVersion}
            cmap="twilight"
          />
        )}
        {probePath && (
          <TiledImageTile
            title="Probe |·|"
            path={probePath}
            slice={0}
            version={iterativeVersion}
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
        <span className="ml-auto flex items-center gap-1 text-text-tertiary" title={`run subscription: ${runMode}`}>
          {isStreaming ? (
            <>
              <Wifi className="w-3 h-3 text-live" />
              <span>live</span>
            </>
          ) : sources.iterativeSource === 'live' ? (
            <>
              <WifiOff className="w-3 h-3" />
              <span>polling</span>
            </>
          ) : (
            <span>{sources.iterativeSource === 'final' ? 'final' : ''}</span>
          )}
        </span>
      </div>
    </div>
  );
}
