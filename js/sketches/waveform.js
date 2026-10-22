/**
 * waveform.js —— 波形示波器
 * 历史轨迹淡出 + 三层叠加
 */

import { Visualizer } from './base.js';
import { getPaletteColors, rgba } from '../lib/palette.js';
import { applySensitivity } from '../lib/dsp.js';

export class WaveformVisualizer extends Visualizer {
  constructor(canvas) {
    super(canvas);
    this.lines = 3;
    this.history = [];
    this.maxHistory = 24;
  }

  resize(width, height) {
    super.resize(width, height);
    this.history = [];
  }

  render(freqData, waveformData) {
    const { width, height, ctx } = this;
    this.clear();

    const colors = getPaletteColors(this.palette, this.lines);

    this.history.unshift(waveformData);
    if (this.history.length > this.maxHistory) this.history.pop();

    // 历史轨迹
    for (let h = 1; h < this.history.length; h++) {
      const alpha = (1 - h / this.history.length) * 0.22;
      this._draw(this.history[h], colors[0], alpha, 0, 1);
    }

    // 当前波形（三层）
    for (let i = 0; i < this.lines; i++) {
      const alpha = 0.95 - i * 0.22;
      const thickness = 3.2 - i * 0.9;
      const offset = (i - 1) * 5;
      this._draw(waveformData, colors[i % colors.length], alpha, offset, thickness);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  _draw(data, color, alpha, yOffset, lineWidth) {
    if (!data || data.length === 0) return;
    const { width, height, ctx } = this;
    const centerY = height / 2 + yOffset;
    const slice = width / data.length;
    const amp = (height / 2) * 0.45 * applySensitivity(1, this.sensitivity);

    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      const y = centerY - v * amp;
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(i * slice, y);
    }
    ctx.stroke();
  }
}
