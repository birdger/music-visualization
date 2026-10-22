/**
 * dsp.js —— 纯函数 DSP 工具层（零浏览器依赖，可在 Node 里直接单测）
 *
 * 这一层存在的理由：频率→bin 的换算、分桶、灵敏度、峰值保持这些是"数学"，
 * 不该和 Web Audio / Canvas 绑在一起。剥出来之后，Node 单测能对着真值断言，
 * 不用起浏览器。
 */

/** 频率(Hz) → FFT bin 下标 */
export function freqToBin(freq, sampleRate, fftSize) {
  return Math.round((freq * fftSize) / sampleRate);
}

/** FFT bin 下标 → 频率(Hz) */
export function binToFreq(bin, sampleRate, fftSize) {
  return (bin * sampleRate) / fftSize;
}

/** 奈奎斯特频率 */
export function nyquist(sampleRate) {
  return sampleRate / 2;
}

/**
 * 频谱分桶：对数分布（人耳感知更接近对数），把线性 bin 分成 count 个桶
 * 返回每桶的 [start, end) bin 区间
 */
export function logBuckets(count, binCount, minBin = 0) {
  const buckets = [];
  if (count <= 0 || binCount <= 0) return buckets;
  const usable = binCount - minBin;
  if (usable <= 0) return buckets;
  for (let i = 0; i < count; i++) {
    const lo = minBin + Math.floor(Math.pow(usable, i / count));
    const hi = minBin + Math.floor(Math.pow(usable, (i + 1) / count));
    buckets.push([lo, Math.max(lo + 1, hi)]);
  }
  return buckets;
}

/** 区间平均（空区间返回 0） */
export function bandAverage(data, start, end) {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(data.length, Math.max(start, end));
  if (hi <= lo) return 0;
  let sum = 0;
  for (let i = lo; i < hi; i++) sum += data[i];
  return sum / (hi - lo);
}

/** 区间最大值 */
export function bandMax(data, start, end) {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(data.length, Math.max(start, end));
  let m = 0;
  for (let i = lo; i < hi; i++) if (data[i] > m) m = data[i];
  return m;
}

/** 灵敏度放大（0~1 的归一化幅值 → 0~1+ 的显示幅值） */
export function applySensitivity(value, sensitivity) {
  return value * sensitivity;
}

/** 归一化到 0~1 */
export function normalize(value, max = 255) {
  if (max === 0) return 0;
  const v = value / max;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * 峰值保持：当前高度超过峰值则更新，否则按 decay 衰减
 * @param {number[]} peaks 原地修改
 * @returns {number[]} peaks（同一引用）
 */
export function peakHold(peaks, index, height, decay = 0.95) {
  if (height > peaks[index]) peaks[index] = height;
  else peaks[index] *= decay;
  return peaks;
}

/** 一阶低通平滑：prev 与 next 按 alpha 混合（alpha=0 全保留 prev，=1 全跟 next） */
export function smoothTowards(prev, next, alpha) {
  return prev + (next - prev) * alpha;
}

/** dB 值 → 0~1 归一化 */
export function dbToNorm(db, minDb = -90, maxDb = -10) {
  if (maxDb === minDb) return 0;
  const t = (db - minDb) / (maxDb - minDb);
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** 线性插值 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** 限制到 [min, max] */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/**
 * 演示音频的采样函数（纯数学，可测）
 * 三个分音叠加 + 缓慢的音量包络，保证频谱有明显起伏而不是一条平线
 */
export function demoSample(t) {
  const env = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.25 * t);
  return env * (
    0.50 * Math.sin(2 * Math.PI * 130.81 * t) +   // C3
    0.30 * Math.sin(2 * Math.PI * 196.00 * t) +   // G3
    0.20 * Math.sin(2 * Math.PI * 261.63 * t)      // C4
  );
}
