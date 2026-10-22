/**
 * radial.js —— 极坐标频谱
 * 径向扇形 + 上下镜像 + 中心低音核
 */

import { Visualizer } from './base.js';
import { getPaletteColors, rgba } from '../lib/palette.js';
import { logBuckets, bandAverage, applySensitivity } from '../lib/dsp.js';

export class RadialVisualizer extends Visualizer {
  constructor(canvas) {
    super(canvas);
    this.segments = 64;
    this.innerRadius = 50;
    this.maxRadius = 200;
    this.rotation = 0;
    this.buckets = [];
  }

  resize(width, height) {
    super.resize(width, height);
    const minDim = Math.min(width, height);
    this.innerRadius = Math.max(30, minDim * 0.1);
    this.maxRadius = minDim * 0.42;
    this.buckets = logBuckets(this.segments, 256);
  }

  render(freqData, waveformData) {
    const { width, height, ctx } = this;
    const centerX = width / 2;
    const centerY = height / 2;
    this.clear();

    this.rotation += 0.0025;
    if (this.rotation > Math.PI * 2) this.rotation -= Math.PI * 2;

    const colors = getPaletteColors(this.palette, this.segments);
    if (!this.buckets.length) this.buckets = logBuckets(this.segments, freqData.length);

    for (let i = 0; i < this.segments; i++) {
      const [lo, hi] = this.buckets[i] || [i, i + 1];
      const mag = applySensitivity(bandAverage(freqData, lo, hi) / 255, this.sensitivity);
      const outerR = this.innerRadius + mag * this.maxRadius;

      const a0 = (i / this.segments) * Math.PI * 2 + this.rotation;
      const a1 = ((i + 1) / this.segments) * Math.PI * 2 + this.rotation;

      const color = colors[i];
      this._segment(centerX, centerY, a0, a1, color);
      this._segment(centerX, centerY, a0 + Math.PI, a1 + Math.PI, color);
    }

    const bass = applySensitivity(bandAverage(freqData, 0, 6) / 255, this.sensitivity);
    const coreSize = this.innerRadius * (0.45 + bass * 0.9);
    const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreSize);
    grad.addColorStop(0, rgba(colors[0], 0.9));
    grad.addColorStop(1, rgba(colors[0], 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, coreSize, 0, Math.PI * 2);
    ctx.fill();
  }

  _segment(cx, cy, a0, a1, color) {
    const { ctx, innerRadius } = this;
    const r = innerRadius + this.maxRadius * 0.45;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a0) * innerRadius, cy + Math.sin(a0) * innerRadius);
    ctx.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.lineTo(cx + Math.cos(a1) * innerRadius, cy + Math.sin(a1) * innerRadius);
    ctx.arc(cx, cy, innerRadius, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = rgba(color, 0.5);
    ctx.fill();
  }
}
