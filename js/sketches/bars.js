/**
 * bars.js —— 频谱柱状
 * 对数分桶（人耳感知）+ 峰值保持线
 */

import { Visualizer } from './base.js';
import { getPaletteColors, rgba } from '../lib/palette.js';
import { logBuckets, bandAverage, peakHold, applySensitivity } from '../lib/dsp.js';

export class BarsVisualizer extends Visualizer {
  constructor(canvas) {
    super(canvas);
    this.barCount = 64;
    this.barWidth = 0;
    this.gap = 2;
    this.peakDecay = 0.95;
    this.peaks = new Float32Array(64);
    this.buckets = [];
  }

  resize(width, height) {
    super.resize(width, height);
    this.barCount = Math.max(16, Math.min(128, Math.floor(width / 6)));
    this.barWidth = Math.max(1, (width - this.gap * (this.barCount - 1)) / this.barCount);
    this.peaks = new Float32Array(this.barCount);
    this.buckets = logBuckets(this.barCount, 256);
  }

  render(freqData, waveformData) {
    const { width, height, ctx } = this;
    this.clear();

    const colors = getPaletteColors(this.palette, this.barCount);
    const bins = freqData.length;
    if (!this.buckets.length) this.buckets = logBuckets(this.barCount, bins);

    for (let i = 0; i < this.barCount; i++) {
      const [lo, hi] = this.buckets[i] || [i, i + 1];
      const avg = bandAverage(freqData, lo, hi);
      const norm = applySensitivity(avg / 255, this.sensitivity);
      const h = Math.min(height * 0.92, norm * height);
      const x = i * (this.barWidth + this.gap);
      const y = height - h;

      const color = colors[i];
      const grad = ctx.createLinearGradient(0, height, 0, height - h);
      grad.addColorStop(0, rgba(color, 0.95));
      grad.addColorStop(1, rgba([255, 255, 255], 0.85));
      ctx.fillStyle = grad;

      const r = Math.min(4, this.barWidth / 2);
      this._roundRect(x, y, this.barWidth, h, r);
      ctx.fill();

      peakHold(this.peaks, i, h, this.peakDecay);
      if (this.peaks[i] > 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        this._roundRect(x, height - this.peaks[i], this.barWidth, 3, 1.5);
        ctx.fill();
      }
    }
  }

  _roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    const rr = Math.min(r, w / 2, Math.max(0, h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }
}
