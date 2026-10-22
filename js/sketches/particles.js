/**
 * particles.js —— 粒子场
 * 低频控制轨道半径，中频控制角速度，高频控制粒子尺寸
 */

import { Visualizer } from './base.js';
import { getPaletteColors, rgba } from '../lib/palette.js';
import { bandAverage, applySensitivity } from '../lib/dsp.js';

export class ParticlesVisualizer extends Visualizer {
  constructor(canvas) {
    super(canvas);
    this.particles = [];
    this.particleCount = 260;
    this.centerX = 0;
    this.centerY = 0;
    this.time = 0;
  }

  resize(width, height) {
    super.resize(width, height);
    this.centerX = width / 2;
    this.centerY = height / 2;
    this._initParticles();
  }

  _initParticles() {
    const { width, height } = this;
    const maxR = Math.min(width, height) * 0.42;
    this.particles = Array.from({ length: this.particleCount }, () => ({
      x: this.centerX + (Math.random() * 2 - 1) * maxR,
      y: this.centerY + (Math.random() * 2 - 1) * maxR,
      vx: 0,
      vy: 0,
      baseSize: 1.5 + Math.random() * 3.5,
      angle: Math.random() * Math.PI * 2,
      radius: 40 + Math.random() * maxR,
      band: Math.floor(Math.random() * 24),
      hue: Math.random() * 360,
    }));
  }

  render(freqData, waveformData) {
    const { width, height, ctx, centerX, centerY } = this;
    this.time += 1 / 60;
    this.clear();

    const bass = applySensitivity(bandAverage(freqData, 0, 6) / 255, this.sensitivity);
    const mid = applySensitivity(bandAverage(freqData, 6, 28) / 255, this.sensitivity);
    const treble = applySensitivity(bandAverage(freqData, 28, 64) / 255, this.sensitivity);

    const colors = getPaletteColors(this.palette, 24);
    const bassPush = 1 + bass * 2.2;
    const midSpin = 0.002 + mid * 0.02;

    for (const p of this.particles) {
      const freqVal = applySensitivity((freqData[p.band] || 0) / 255, this.sensitivity);
      const push = 1 + freqVal * 2.5;

      p.angle += midSpin;
      const targetX = centerX + Math.cos(p.angle) * p.radius * push * bassPush;
      const targetY = centerY + Math.sin(p.angle) * p.radius * push * bassPush;

      p.vx += (targetX - p.x) * 0.012;
      p.vy += (targetY - p.y) * 0.012;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.x += p.vx;
      p.y += p.vy;

      const size = p.baseSize * (1 + treble * 1.8);
      const color = colors[p.band % colors.length];
      const alpha = 0.35 + 0.55 * (1 - p.radius / Math.max(width, height));

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = rgba(color, alpha);
      ctx.fill();

      if (p.x < -60) p.x = width + 60;
      if (p.x > width + 60) p.x = -60;
      if (p.y < -60) p.y = height + 60;
      if (p.y > height + 60) p.y = -60;
    }

    if (bass > 0.15) {
      const radius = 180 * (1 + bass);
      const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      grad.addColorStop(0, rgba(colors[0], 0.18 * bass));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
  }
}
