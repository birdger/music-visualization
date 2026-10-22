/**
 * main.js —— 音乐可视化工坊入口
 * 装配 Web Audio 引擎、5 个可视化 sketch、UI 控件与无头验证接口
 */

import { audioEngine } from './lib/audio-engine.js';
import { BarsVisualizer } from './sketches/bars.js';
import { ParticlesVisualizer } from './sketches/particles.js';
import { WaveformVisualizer } from './sketches/waveform.js';
import { RadialVisualizer } from './sketches/radial.js';
import { CircularBarsVisualizer } from './sketches/circular-bars.js';

const canvas = document.getElementById('canvas');
const vizSelect = document.getElementById('viz-select');
const paletteSelect = document.getElementById('palette-select');
const sensitivitySlider = document.getElementById('sensitivity');
const smoothingSlider = document.getElementById('smoothing');
const fftSelect = document.getElementById('fft-select');
const audioFileInput = document.getElementById('audio-file');
const micToggle = document.getElementById('mic-toggle');
const playPauseBtn = document.getElementById('play-pause');
const seekSlider = document.getElementById('seek');
const volumeSlider = document.getElementById('volume');
const sensVal = document.getElementById('sens-val');
const smoothVal = document.getElementById('smooth-val');

const visualizers = {
  bars: new BarsVisualizer(canvas),
  particles: new ParticlesVisualizer(canvas),
  waveform: new WaveformVisualizer(canvas),
  radial: new RadialVisualizer(canvas),
  'circular-bars': new CircularBarsVisualizer(canvas)
};

let currentVisualizerId = 'bars';
let currentVisualizer = visualizers.bars;
let animationId = null;
let driving = false;

// 模拟数据源（供无头浏览器或无声卡环境验证）
let mockFreqData = null;
let mockWaveformData = null;

function resizeCanvas() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  Object.values(visualizers).forEach(v => v.resize(w, h));
}

function setVisualizer(id) {
  if (!visualizers[id]) return;
  currentVisualizerId = id;
  currentVisualizer = visualizers[id];
  vizSelect.value = id;
  resizeCanvas();
}

function setPalette(name) {
  paletteSelect.value = name;
  Object.values(visualizers).forEach(v => v.setPalette(name));
}

function setSensitivity(val) {
  sensitivitySlider.value = val;
  sensVal.textContent = Number(val).toFixed(1);
  Object.values(visualizers).forEach(v => v.setSensitivity(val));
}

function updatePlayPauseBtn(playing) {
  playPauseBtn.textContent = playing ? '⏸️' : '▶️';
}

function renderFrame() {
  const freqData = mockFreqData || audioEngine.getFrequencyData();
  const waveformData = mockWaveformData || audioEngine.getWaveformData();

  if (audioEngine.duration && isFinite(audioEngine.duration) && audioEngine.isPlaying) {
    seekSlider.value = (audioEngine.currentTime / audioEngine.duration) * 100;
  }

  currentVisualizer.render(freqData, waveformData);
}

function startDrive() {
  if (driving) return;
  driving = true;
  function loop() {
    if (!driving) return;
    renderFrame();
    animationId = requestAnimationFrame(loop);
  }
  animationId = requestAnimationFrame(loop);
}

function stopDrive() {
  driving = false;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

function setupUI() {
  vizSelect.addEventListener('change', () => setVisualizer(vizSelect.value));
  paletteSelect.addEventListener('change', () => setPalette(paletteSelect.value));

  sensitivitySlider.addEventListener('input', () => {
    setSensitivity(parseFloat(sensitivitySlider.value));
  });

  smoothingSlider.addEventListener('input', () => {
    const val = parseFloat(smoothingSlider.value);
    smoothVal.textContent = val.toFixed(2);
    audioEngine.setSmoothing(val);
  });

  fftSelect.addEventListener('change', () => {
    audioEngine.setFFTSize(parseInt(fftSelect.value, 10));
  });

  audioFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        await audioEngine.playFile(file);
        updatePlayPauseBtn(true);
      } catch (err) {
        console.error('Failed to play file:', err);
        alert('无法播放该音频文件');
      }
    }
  });

  micToggle.addEventListener('click', async () => {
    if (audioEngine.sourceKind === 'mic') {
      audioEngine.stop();
      micToggle.textContent = '🎤';
      micToggle.style.color = '';
      updatePlayPauseBtn(false);
    } else {
      try {
        await audioEngine.startMicrophone();
        micToggle.textContent = '🔴';
        micToggle.style.color = '#ff4444';
        updatePlayPauseBtn(true);
      } catch (err) {
        alert('无法访问麦克风：' + err.message);
      }
    }
  });

  playPauseBtn.addEventListener('click', async () => {
    const playing = await audioEngine.togglePlayPause();
    updatePlayPauseBtn(playing);
  });

  seekSlider.addEventListener('input', () => {
    if (audioEngine.duration && isFinite(audioEngine.duration)) {
      const target = (seekSlider.value / 100) * audioEngine.duration;
      audioEngine.seek(target);
    }
  });

  volumeSlider.addEventListener('input', () => {
    audioEngine.setGain(volumeSlider.value / 100);
  });
}

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        playPauseBtn.click();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        audioEngine.seekBy(-5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        audioEngine.seekBy(5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        volumeSlider.value = Math.min(100, parseInt(volumeSlider.value, 10) + 10);
        volumeSlider.dispatchEvent(new Event('input'));
        break;
      case 'ArrowDown':
        e.preventDefault();
        volumeSlider.value = Math.max(0, parseInt(volumeSlider.value, 10) - 10);
        volumeSlider.dispatchEvent(new Event('input'));
        break;
      case 'f':
      case 'F':
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen();
        }
        break;
      case 'w':
      case 'W': {
        const opts = Array.from(vizSelect.options).map(o => o.value);
        const idx = (opts.indexOf(currentVisualizerId) - 1 + opts.length) % opts.length;
        setVisualizer(opts[idx]);
        break;
      }
      case 's':
      case 'S': {
        const opts = Array.from(vizSelect.options).map(o => o.value);
        const idx = (opts.indexOf(currentVisualizerId) + 1) % opts.length;
        setVisualizer(opts[idx]);
        break;
      }
      case 'a':
      case 'A': {
        const opts = Array.from(paletteSelect.options).map(o => o.value);
        const idx = (opts.indexOf(paletteSelect.value) - 1 + opts.length) % opts.length;
        setPalette(opts[idx]);
        break;
      }
      case 'd':
      case 'D': {
        const opts = Array.from(paletteSelect.options).map(o => o.value);
        const idx = (opts.indexOf(paletteSelect.value) + 1) % opts.length;
        setPalette(opts[idx]);
        break;
      }
    }
  });
}

// 像素采样分析辅助工具
function pixelProbe(canvasSel = '#canvas', { step = 4 } = {}) {
  const c = document.querySelector(canvasSel);
  if (!c) return { colors: 0, nonBackground: 0, w: 0, h: 0 };
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = c.width;
  const h = c.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const bgR = 10, bgG = 10, bgB = 15; // #0a0a0f
  let nonBgCount = 0;
  let sampled = 0;
  const colorSet = new Set();

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      sampled++;

      const dist = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
      if (dist > 15) nonBgCount++;

      // 量化颜色
      const key = `${r >> 3},${g >> 3},${b >> 3}`;
      colorSet.add(key);
    }
  }

  return {
    colors: colorSet.size,
    nonBackground: sampled > 0 ? nonBgCount / sampled : 0,
    w,
    h
  };
}

// 导出全局测试与自动化接口
window.__mv = {
  audioEngine,
  visualizers,
  get currentVisualizerId() { return currentVisualizerId; },
  get currentVisualizer() { return currentVisualizer; },
  setVisualizer,
  setPalette,
  setSensitivity,
  renderFrame,
  startDrive,
  stopDrive,
  feedMockData: (freq, wave) => {
    mockFreqData = freq;
    mockWaveformData = wave;
  },
  pixelProbe,
  status: () => ({
    visualizer: currentVisualizerId,
    palette: paletteSelect.value,
    sensitivity: parseFloat(sensitivitySlider.value),
    smoothing: parseFloat(smoothingSlider.value),
    fftSize: parseInt(fftSelect.value, 10),
    isPlaying: audioEngine.isPlaying,
    sourceKind: audioEngine.sourceKind,
    currentTime: audioEngine.currentTime,
    duration: audioEngine.duration
  })
};

// 初始化
window.addEventListener('resize', resizeCanvas);
setupUI();
setupKeyboard();
resizeCanvas();
startDrive();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopDrive();
  else startDrive();
});
