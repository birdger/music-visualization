// tools/core.test.mjs —— 纯函数 DSP 层单测（零浏览器依赖）
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  freqToBin, binToFreq, logBuckets, bandAverage, normalize,
  applySensitivity, peakHold, smoothTowards, dbToNorm, lerp, clamp,
  demoSample
} from '../js/lib/dsp.js';

describe('dsp — 频率/分桶/数学真值', () => {
  it('freqToBin / binToFreq 双向一致', () => {
    assert.strictEqual(freqToBin(440, 44100, 512), 5);
    assert.strictEqual(Math.round(binToFreq(5, 44100, 512)), 431); // 约 431Hz，接近
  });

  it('logBuckets 对数分桶长度', () => {
    const b = logBuckets(8, 256);
    assert.strictEqual(b.length, 8);
    assert.ok(b[0][0] < b[0][1]);
    assert.ok(b[7][1] <= 256);
  });

  it('bandAverage 区间平均', () => {
    const d = [0, 128, 255, 0, 128];
    assert.strictEqual(Math.round(bandAverage(d, 0, 5)), Math.round(102.2));
  });

  it('normalize 归一化', () => {
    assert.strictEqual(normalize(128, 255), 128 / 255);
    assert.strictEqual(normalize(300, 255), 1);
    assert.strictEqual(normalize(-10, 255), 0);
  });

  it('applySensitivity', () => {
    assert.strictEqual(applySensitivity(0.5, 2), 1.0);
    assert.strictEqual(applySensitivity(0.5, 0.5), 0.25);
  });

  it('peakHold 衰减 + 更新', () => {
    const p = [0, 100, 0];
    peakHold(p, 1, 120, 0.9);
    assert.strictEqual(p[1], 120);
    peakHold(p, 1, 50, 0.9);
    assert.ok(p[1] < 120);
  });

  it('smoothTowards 一阶低通', () => {
    assert.strictEqual(smoothTowards(0, 100, 0.5), 50);
    assert.strictEqual(smoothTowards(100, 0, 0.75), 25);
  });

  it('dbToNorm', () => {
    assert.strictEqual(Math.round(dbToNorm(-90) * 100) / 100, 0);
    assert.strictEqual(Math.round(dbToNorm(-10) * 100) / 100, 1);
  });

  it('lerp', () => {
    assert.strictEqual(lerp(0, 10, 0.3), 3);
  });

  it('clamp', () => {
    assert.strictEqual(clamp(5, 0, 10), 5);
    assert.strictEqual(clamp(-5, 0, 10), 0);
    assert.strictEqual(clamp(15, 0, 10), 10);
  });

  it('demoSample 有可测输出 + 非零', () => {
    const v = demoSample(0.5);
    assert.strictEqual(typeof v, 'number');
    // demoSample(0.5) 在整数半周期可能接近 0，改用相对阈值
    assert.ok(Math.abs(v) > 0.01);
  });
});