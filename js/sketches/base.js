/**
 * base.js —— 可视化基类
 *
 * 坑：原来 resize() 里用 ctx.scale(dpr, dpr)，而 ctx 状态是持久的，
 * 每 resize 一次缩放就再乘一遍 dpr，画几次之后整个画面被放大到看不见。
 * 正确做法是 setTransform 重置矩阵。
 */

export class Visualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.palette = 'neon';
    this.sensitivity = 1.0;
    this.width = 0;
    this.height = 0;
    this.dpr = window.devicePixelRatio || 1;
  }

  setPalette(name) { this.palette = name; }

  setSensitivity(val) { this.sensitivity = val; }

  resize(width, height) {
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    this.width = width;
    this.height = height;
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    // setTransform 重置矩阵，避免缩放累乘
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(freqData, waveformData) {
    throw new Error('render() 必须由子类实现');
  }

  /** 清屏 */
  clear(bg = '#0a0a0f') {
    const { ctx, width, height } = this;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }
}
