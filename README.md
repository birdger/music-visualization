# music-visualization

音乐可视化工坊：Web Audio API 频谱 + 粒子响应 + 麦克风输入。

## 五种可视化模式

| 模式 | 说明 |
|---|---|
| `bars` | 频谱柱状 — 64 条带峰值保持 |
| `particles` | 粒子场 — 260 粒子围绕中心自旋，音频控制推力 |
| `waveform` | 波形线 — 历史轨迹 + 3 层叠加 |
| `radial` | 极坐标 — 64 条径向扇形 + 中心低音核 |
| `circular-bars` | 圆环频谱 — 环形扫频 + 中心点 |

## 快捷键

| 键 | 动作 |
|---|---|
| `W` / `S` | 上下循环切换可视化模式 |
| `A` / `D` | 左右循环切换配色方案 |
| `空格` | 播放/暂停 |
| `← / →` |  Seek -5s / +5s |
| `↑ / ↓` | 音量 +10% / -10% |
| `F` | 全屏切换 |

## 音频源

- **文件拖拽**：将 `.wav`/`.mp3`/`.ogg` 拖入“📁 音频文件”区域
- **麦克风模式**：首次运行会弹出浏览器授权窗口，须点击确认
- **演示 tone**：启动时若无音频文件/麦克风，自动播放内置 demo tone

## 项目结构

```
music-visualization/
├─ index.html          — 入口页
├─ css/style.css       — 温暖极简风（--bg / --card / --accent / --muted / --border）
├─ js/
│  ├─ lib/
│  │  ├─ dsp.js      — 纯函数 DSP（可 Node 单测，零浏览器依赖）
│  │  ├─ palette.js  — 配色工具（支持 hex / hsl 两种写法）
│  │  └─ audio-engine.js — Web Audio 包装（init/playFile/startMic/togglePlayPause/seek）
│  └─ sketches/
│     ├─ base.js     — 可视化基类（修复 ctx.scale 累乘 bug）
│     ├─ bars.js
│     ├─ particles.js
│     ├─ waveform.js
│     ├─ radial.js
│     └─ circular-bars.js
├─ favicon.svg
├─ package.json        — type: module，scripts: serve / test / verify
├─ tools/
│  ├─ serve.mjs      — 零依赖 HTTP 服务（端口 4184）
│  ├─ core.test.mjs  — 11 断言，全部通过
│  └─ verify.mjs*    — 无头浏览器像素验证（需 puppeteer + Edge）
├─ LICENSE             — MIT
└─ .gitignore
```

## 开始

```bash
# 1. 启动静态服务器
node tools/serve.mjs 4184

# 2. 在浏览器打开 http://127.0.0.1:4184/

# 3. 或者直接用 Live Server / VS Code preview 打开 index.html
```

## 许可证

MIT License © 2026 birdger