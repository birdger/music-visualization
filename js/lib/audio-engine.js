/**
 * audio-engine.js —— Web Audio 音频引擎（浏览器专有层）
 *
 * 分层约定：凡是能写成纯函数的逻辑都放到 lib/dsp.js，这里只留真正需要
 * AudioContext 的部分。这样 Node 单测可以对着数学真值断言，浏览器只负责
 * 把采样喂进来。
 *
 * 踩过的坑：
 *  1) seek() 里先 this.stop() 再取 this.source.buffer —— stop() 已经把
 *     source 置空，buffer 永远读到 undefined。必须先取引用再停。
 *  2) togglePlayPause() 直接重建 source 会把播放位置退回 0，应该记住 offset。
 *  3) setFFTSize() 重建 analyser 时写的是 this.analyser.smoothingTimeConstant =
 *     this.analyser.smoothingTimeConstant（自我赋值，no-op），平滑度被重置成默认。
 */

import { demoSample } from './dsp.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.gainNode = null;
    this.source = null;
    this.sourceKind = 'none';   // 'buffer' | 'mic' | 'none'
    this.mediaStream = null;
    this.buffer = null;          // 当前播放的 AudioBuffer（暂停/续播/跳转都要用）
    this.startedAt = 0;          // ctx.currentTime 基准
    this.offset = 0;             // 本次播放起点在 buffer 内的位置（秒）
    this.isPlaying = false;
    this.volume = 0.8;
    this.sensitivity = 1;
    this.onEnded = null;
    this.onTimeUpdate = null;
  }

  /** 初始化 AudioContext（必须在用户手势后调用） */
  async init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return this.ctx;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) throw new Error('浏览器不支持 Web Audio API');
    this.ctx = new Ctor();

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = this.volume;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;

    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    return this.ctx;
  }

  /** 重建 analyser（改 FFT 大小时），保留当前平滑度与音量 */
  _rebuildAnalyser(fftSize) {
    const smoothing = this.analyser ? this.analyser.smoothingTimeConstant : 0.8;
    if (this.analyser) {
      try { this.gainNode.disconnect(this.analyser); } catch { /* 已断开 */ }
    }
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = fftSize;
    this.analyser.smoothingTimeConstant = smoothing;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  setFFTSize(size) {
    if (!this.ctx) return;
    this._rebuildAnalyser(size);
  }

  setSmoothing(val) {
    if (this.analyser) this.analyser.smoothingTimeConstant = val;
  }

  setGain(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.gainNode) this.gainNode.gain.value = this.volume;
  }

  setSensitivity(val) {
    this.sensitivity = val;
  }

  /** 频域数据（0~255） */
  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(128);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  /** 时域波形（0~255，128 为零点） */
  getWaveformData() {
    if (!this.analyser) return new Uint8Array(128);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  /** 当前播放位置（秒） */
  get currentTime() {
    if (this.sourceKind === 'buffer' && this.buffer) {
      const t = this.offset + (this.isPlaying ? this.ctx.currentTime - this.startedAt : 0);
      return this.buffer.duration ? t % this.buffer.duration : t;
    }
    return 0;
  }

  get duration() {
    return this.buffer ? this.buffer.duration : 0;
  }

  /** 停止并释放当前源 */
  stop() {
    if (this.source) {
      try { this.source.stop(); } catch { /* 已经停了 */ }
      try { this.source.disconnect(); } catch { /* 已断开 */ }
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    this.sourceKind = 'none';
    this.isPlaying = false;
    this.offset = 0;
  }

  /** 播放一个 AudioBuffer（可指定起始偏移） */
  async playBuffer(buffer, offset = 0) {
    this.stop();
    await this.init();
    this.buffer = buffer;
    this.source = this.ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;
    this.source.connect(this.gainNode);
    this.source.start(0, offset % buffer.duration);
    this.sourceKind = 'buffer';
    this.isPlaying = true;
    this.startedAt = this.ctx.currentTime;
    this.offset = offset % buffer.duration;
    if (this.onTimeUpdate) this.onTimeUpdate(this.currentTime, this.duration);
  }

  /** 播放用户选择的音频文件 */
  async playFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(arrayBuffer);
    await this.playBuffer(buffer, 0);
    return buffer;
  }

  /** 麦克风输入 */
  async startMicrophone() {
    this.stop();
    await this.init();
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.source = this.ctx.createMediaStreamSource(this.mediaStream);
    this.source.connect(this.gainNode);
    this.sourceKind = 'mic';
    this.isPlaying = true;
    this.buffer = null;
  }

  /** 生成内置演示音频（纯数学合成，见 lib/dsp.js 的 demoSample） */
  async loadDemoTone(duration = 8) {
    await this.init();
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * duration);
    const buffer = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        // 右声道加一点失谐，听感更宽
        data[i] = demoSample(t + ch * 0.0012);
      }
    }
    this.demoBuffer = buffer;
    return buffer;
  }

  /** 播放内置演示 */
  async playDemo() {
    if (!this.demoBuffer) await this.loadDemoTone();
    await this.playBuffer(this.demoBuffer, 0);
  }

  /** 播放 / 暂停切换（暂停会记住位置） */
  async togglePlayPause() {
    await this.init();
    if (this.sourceKind === 'mic') {
      this.isPlaying = !this.isPlaying;
      if (this.gainNode) this.gainNode.gain.value = this.isPlaying ? this.volume : 0;
      return this.isPlaying;
    }
    if (this.sourceKind === 'buffer' && this.buffer) {
      if (this.isPlaying) {
        this.offset = this.currentTime;
        this.stop();
        // stop() 会清 offset，这里补回来
        this.offset = this.currentTime;
        this.isPlaying = false;
        this.sourceKind = 'buffer';
        return false;
      }
      await this.playBuffer(this.buffer, this.offset);
      return true;
    }
    // 还没播过任何东西：直接放演示音
    await this.playDemo();
    return true;
  }

  /** 跳转到指定秒数 */
  async seek(seconds) {
    if (!this.buffer) return;
    const target = Math.max(0, Math.min(seconds, this.buffer.duration));
    await this.playBuffer(this.buffer, target);
  }

  /** 相对跳转（±秒） */
  async seekBy(delta) {
    if (!this.buffer) return;
    await this.seek(this.currentTime + delta);
  }

  destroy() {
    this.stop();
    if (this.ctx) this.ctx.close();
    this.ctx = null;
  }
}

export const audioEngine = new AudioEngine();
