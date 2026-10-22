/**
 * circular-bars.js —— 圆环频谱
 * 环形扫频弧段 + 中心低音点
 */

import { Visualizer } from './base.js';
import { getPaletteColors, rgba } from '../lib/palette.js';
import { logBuckets, bandAverage, applySensitivity } from '../lib/dsp.js';

export class CircularBarsVisualizer extends Visualizer {
  constructor(canvas) {
    super(canvas);
    this.segments = 50;
    this.innerRadius = 60;
    this.thickness = 120;
    this.arcPad = 0.004;   // 弧度间隙
    this.buckets = [];
  }

  resize(width, height) {
    super.resize(width, height);
    const minDim = Math.min(width, height);
    this.innerRadius = Math.max(40, minDim * 0.14);
    this.thickness = Math.max(60, minDim * 0.26);
    this.buckets = logBuckets(this.segments, 256);
  }

  render(freqData, waveformData) {
    const { width, height, ctx } = this;
    const centerX = width / 2;
    const centerY = height / 2;
    this.clear();

    const colors = getPaletteColors(this.palette, this.segments);
    if (!this.buckets.length) this.buckets = logBuckets(this.segments, freqData.length);

    for (let i = 0; i < this.segments; i++) {
      const [lo, hi] = this.buckets[i] || [i, i + 1];
      const mag = applySensitivity(bandAverage(freqData, lo, hi) / 255, this.sensitivity);

      const a0 = (i / this.segments) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / this.segments) * Math.PI * 2 - Math.PI / 2;

      const r0 = this.innerRadius;
      const r1 = this.innerRadius + Math.max(1, mag * this.thickness);

      ctx.beginPath();
      ctx.arc(centerX, centerY, r1, a0 + this.arcPad, a1 - this.arcPad);
      ctx.arc(centerX, centerY, r0, a1 - this.arcPad, a0 + this.arcPad, true);
      ctx.closePath();

      const color = colors[i];
      ctx.fillStyle = rgba(color, 0.9);
      ctx.fill();
    }

    // 外圈描边
    ctx.strokeStyle = rgba(colors[0], 0.25);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.innerRadius + this.thickness, 0, Math.PI * 2);
    ctx.stroke();

    // 中心低音点
    const bass = applySensitivity(bandAverage(freqData, 0, 6) / 255, this.sensitivity);
    const core = 4 + bass * this.innerRadius * 0.9;
    const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, core);
    grad.addColorStop(0, rgba(colors[0], 1));
    grad.addColorStop(1, rgba(colors[0], 0.2));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, core, 0, Math.PI * 2);
    ctx.fill();
  }
}
