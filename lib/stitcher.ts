// Incremental mosaic stitcher for ViT predictions.
//
// Mirrors holoptycho/live_compare_viewer.py::IncrementalStitcher: scan
// positions are converted to meters, each per-frame phase patch is cropped
// to remove edge artifacts, then bilinearly interpolated onto a global
// meter-scale canvas. Overlapping regions are averaged.
//
// The original Python implementation pulls real positions out of the scan
// H5 file. We're running in the dashboard with no H5 access, so positions
// are reconstructed deterministically from the scan-grid metadata
// (x_num/y_num, x_range_um/y_range_um, x_direction/y_direction). This is
// exactly what ptycho_holo.py uses for `simulate_positions` — for live
// scans the real PandA positions deviate by motor jitter (nm scale), which
// is below visible resolution at the mosaic level.

export interface StitcherConfig {
  xNum: number;
  yNum: number;
  xRangeUm: number;
  yRangeUm: number;
  xDirection: number;
  yDirection: number;
  pixelSizeM: number;
  // Number of border pixels to discard from each patch before placement,
  // matches live_compare_viewer.py default.
  innerCrop?: number;
  // Padding added around the canvas in meters.
  padM?: number;
}

export interface MosaicView {
  data: Float32Array;
  width: number;
  height: number;
}

export class IncrementalStitcher {
  private readonly posX: Float64Array;
  private readonly posY: Float64Array;
  private readonly pixelSizeM: number;
  private readonly innerCrop: number;
  private readonly padM: number;

  private xGrid0 = 0;
  private yGrid0 = 0;
  private gridW = 0;
  private gridH = 0;
  private mosaic: Float32Array | null = null;
  private counts: Uint32Array | null = null;
  private initialized = false;
  private patchSize = 0;

  constructor(config: StitcherConfig) {
    const {
      xNum, yNum, xRangeUm, yRangeUm,
      xDirection, yDirection, pixelSizeM,
      innerCrop = 32, padM = 0.5e-6,
    } = config;

    this.pixelSizeM = pixelSizeM;
    this.innerCrop = innerCrop;
    this.padM = padM;

    // Reproduce ptycho_holo.py's simulate_positions ordering:
    //   pos[i*xNum + j] = (j*dx*xDir, i*dy*yDir), dx = xRange/xNum (microns).
    const total = xNum * yNum;
    this.posX = new Float64Array(total);
    this.posY = new Float64Array(total);
    const dxUm = xNum > 0 ? xRangeUm / xNum : 0;
    const dyUm = yNum > 0 ? yRangeUm / yNum : 0;
    for (let i = 0; i < yNum; i++) {
      for (let j = 0; j < xNum; j++) {
        const k = i * xNum + j;
        this.posX[k] = j * dxUm * xDirection * 1e-6;
        this.posY[k] = i * dyUm * yDirection * 1e-6;
      }
    }
  }

  private initFromPatchSize(patchSize: number): void {
    const ps = this.pixelSizeM;
    this.patchSize = patchSize;

    let xMin = Infinity, xMax = -Infinity;
    let yMin = Infinity, yMax = -Infinity;
    for (let k = 0; k < this.posX.length; k++) {
      if (this.posX[k] < xMin) xMin = this.posX[k];
      if (this.posX[k] > xMax) xMax = this.posX[k];
      if (this.posY[k] < yMin) yMin = this.posY[k];
      if (this.posY[k] > yMax) yMax = this.posY[k];
    }

    this.xGrid0 = xMin - this.padM;
    this.yGrid0 = yMin - this.padM;
    this.gridW = Math.max(1, Math.ceil((xMax + this.padM - this.xGrid0) / ps));
    this.gridH = Math.max(1, Math.ceil((yMax + this.padM - this.yGrid0) / ps));

    this.mosaic = new Float32Array(this.gridW * this.gridH);
    this.counts = new Uint32Array(this.gridW * this.gridH);
    this.initialized = true;
  }

  // Stitch a batch into the mosaic. `pred` is a flattened [B, C, H, W]
  // float32 array with phase on channel 1; `indices` are scan-frame indices.
  // Caller is responsible for not passing the same batch twice — the
  // stitcher accumulates blindly.
  addBatch(pred: Float32Array, indices: Int32Array, shape: number[]): void {
    if (shape.length !== 4) {
      console.warn('[Stitcher] expected 4D pred, got shape', shape);
      return;
    }
    const [B, C, H, W] = shape;
    if (!this.initialized) this.initFromPatchSize(H);

    const ps = this.pixelSizeM;
    const crop = this.innerCrop;
    const Hc = H - 2 * crop;
    const Wc = W - 2 * crop;
    if (Hc <= 1 || Wc <= 1) {
      console.warn('[Stitcher] patch too small for crop', H, W, crop);
      return;
    }

    // Phase channel = 1 when present (amplitude=0). Fall back to chan 0 for
    // single-channel predictions.
    const phaseChan = C >= 2 ? 1 : 0;
    const mosaic = this.mosaic!;
    const counts = this.counts!;
    const gridW = this.gridW;
    const gridH = this.gridH;

    for (let b = 0; b < B; b++) {
      const idx = indices[b];
      if (idx < 0 || idx >= this.posX.length) continue;

      // Cropped patch corner positions in meters.
      const xLocal0 = this.posX[idx] + (crop - (H - 1) / 2) * ps;
      const yLocal0 = this.posY[idx] + (crop - (H - 1) / 2) * ps;
      const xLocalEnd = xLocal0 + (Wc - 1) * ps;
      const yLocalEnd = yLocal0 + (Hc - 1) * ps;

      // Canvas window — searchsorted equivalents on a uniform grid.
      const ix0 = Math.max(Math.ceil((xLocal0 - this.xGrid0) / ps), 0);
      const ix1 = Math.min(Math.floor((xLocalEnd - this.xGrid0) / ps) + 1, gridW);
      const iy0 = Math.max(Math.ceil((yLocal0 - this.yGrid0) / ps), 0);
      const iy1 = Math.min(Math.floor((yLocalEnd - this.yGrid0) / ps) + 1, gridH);
      if (ix1 <= ix0 || iy1 <= iy0) continue;

      const patchOffset = b * C * H * W + phaseChan * H * W;

      for (let gy = iy0; gy < iy1; gy++) {
        const cy = this.yGrid0 + gy * ps;
        const yPx = (cy - yLocal0) / ps;
        if (yPx < 0 || yPx > Hc - 1) continue;
        const iyRaw = Math.floor(yPx);
        const iy = iyRaw >= Hc - 1 ? Hc - 2 : iyRaw;
        const ty = iyRaw >= Hc - 1 ? 1 : yPx - iyRaw;
        // Patch rows are addressed in the uncropped frame, so add `crop`.
        const yA = (iy + crop) * W;
        const yB = (iy + 1 + crop) * W;
        const rowFlat = gy * gridW;

        for (let gx = ix0; gx < ix1; gx++) {
          const cx = this.xGrid0 + gx * ps;
          const xPx = (cx - xLocal0) / ps;
          if (xPx < 0 || xPx > Wc - 1) continue;
          const ixRaw = Math.floor(xPx);
          const ix = ixRaw >= Wc - 1 ? Wc - 2 : ixRaw;
          const tx = ixRaw >= Wc - 1 ? 1 : xPx - ixRaw;
          const xA = ix + crop;
          const xB = ix + 1 + crop;

          const v00 = pred[patchOffset + yA + xA];
          const v01 = pred[patchOffset + yA + xB];
          const v10 = pred[patchOffset + yB + xA];
          const v11 = pred[patchOffset + yB + xB];

          const w00 = (1 - ty) * (1 - tx);
          const w01 = (1 - ty) * tx;
          const w10 = ty * (1 - tx);
          const w11 = ty * tx;
          const v = w00 * v00 + w01 * v01 + w10 * v10 + w11 * v11;

          // Match the Python stitcher: only count cells that received a
          // non-zero contribution. RegularGridInterpolator's fill_value=0
          // means out-of-patch returns 0 there; we already skipped those
          // via the bounds checks, but exact zeros from real data are
          // still excluded from the average — preserving parity.
          if (v !== 0) {
            mosaic[rowFlat + gx] += v;
            counts[rowFlat + gx] += 1;
          }
        }
      }
    }
  }

  // Produce mosaic / counts. Returns null until at least one batch has been
  // stitched.
  getMosaic(): MosaicView | null {
    if (!this.mosaic || !this.counts) return null;
    const out = new Float32Array(this.mosaic.length);
    const m = this.mosaic;
    const c = this.counts;
    for (let i = 0; i < out.length; i++) {
      out[i] = c[i] > 0 ? m[i] / c[i] : 0;
    }
    return { data: out, width: this.gridW, height: this.gridH };
  }

  get patchSizeReady(): boolean {
    return this.initialized;
  }
}

// Render a Float32Array mosaic to an ImageData using a perceptually-flat
// gray ramp, mapped from [vmin, vmax]. NaN/empty cells render as
// background. Used by the canvas tile.
export function mosaicToImageData(
  mosaic: MosaicView,
  vmin?: number,
  vmax?: number,
): ImageData {
  const { data, width, height } = mosaic;
  let lo = vmin ?? Infinity;
  let hi = vmax ?? -Infinity;
  if (vmin === undefined || vmax === undefined) {
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (!Number.isFinite(v) || v === 0) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
      lo = 0;
      hi = 1;
    }
  }
  const span = hi - lo;
  const px = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    let g: number;
    if (!Number.isFinite(v) || v === 0) {
      g = 24; // empty/background
    } else {
      const t = Math.max(0, Math.min(1, (v - lo) / span));
      g = Math.round(t * 255);
    }
    const j = i * 4;
    px[j] = g;
    px[j + 1] = g;
    px[j + 2] = g;
    px[j + 3] = 255;
  }
  return new ImageData(px, width, height);
}
