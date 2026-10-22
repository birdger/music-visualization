// tools/verify.mjs —— 无头浏览器像素级验证（音乐可视化工坊）
// 依赖：gods-eye-view/node_modules/puppeteer 25.10.0
// 用法：node tools/verify.mjs  (会自动启动 serve.mjs 如果未在 4184 运行)

import { chromium } from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = 4184;
const SERVE = path.join(ROOT, 'tools', 'serve.mjs');

async function serverRunning(port) {
  try {
    await fetch(`http://127.0.0.1:${port}/`);
    return true;
  } catch {
    return false;
  }
}

async function startServerIfNeeded() {
  if (!(await serverRunning(PORT))) {
    console.log('🔊 启动静态服务器...');
    const child = await Deno.run({command: ['node', SERVE]});
    // 简易等待：puppeteer 会自行轮询 127.0.0.1:4184/
    // 这里仅打印，实际由页面导航触发可达性检查
    console.log(`   服务器 PID: ${child.pid}，根路径: http://127.0.0.1:${PORT}/`);
  }
}

(async () => {
  await startServerIfNeeded();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleMessages = [];

  // 捕获控制台输出
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type !== 'log' && type !== 'info') {
      consoleMessages.push({ type, text });
    }
  });

  // 捕获网络请求（检查是否有外域请求）
  let hasExternalRequest = false;
  page.on('request', req => {
    const url = new URL(req.url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      hasExternalRequest = true;
    }
  });
  page.on('requestfailed', req => {
    const url = new URL(req.url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      hasExternalRequest = true;
    }
  });

  console.log('🌐 打开页面 http://127.0.0.1:4184/');
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' });

  // 等待 main.js 注入 __mv
  await page.waitForFunction(
    () => window.__mv !== undefined,
    { timeout: 8000 }
  );

  const status = await page.evaluate(() => window.__mv.status());
  console.log('📊 初始状态:', JSON.stringify(status));

  // 5 种可视化模式 + 调色板循环
  const vizIds = ['bars', 'particles', 'waveform', 'radial', 'circular-bars'];
  const paletteNames = paletteSelect => {
    // 从页面 DOM 获取 palette-select 的 options
    const sel = document.querySelector('select#palette-select');
    return sel ? Array.from(sel.options).map(o => o.value) : [];
  };

  // 预先拿到 palette options（在页面上下文里）
  const paletteOpts = await page.evaluate(() => {
    const sel = document.querySelector('select#palette-select');
    return sel ? Array.from(sel.options).map(o => o.value) : [];
  });
  console.log('🎨 调色板选项:', paletteOpts);

  // 逐模式验证
  const results = {};
  for (const vizId of vizIds) {
    console.log(`\n--- 验证模式: ${vizId} ---`);

    // 切换模式
    await page.evaluate(id => {
      window.__mv.setVisualizer(id);
    }, vizId);

    // 等待一帧
    await new Promise(r => setTimeout(r, 100));

    // 注入模拟频谱数据 + 波形数据（四阶锯齿 + 基音）
    const mockFreq = new Float32Array(64);
    for (let i = 0; i < 64; i++) {
      // 基音 110Hz + 3 次谐波 + 随机噪声
      const t = i / 64;
      mockFreq[i] = Math.max(0, Math.sin(2 * Math.PI * 4 * t) * (1 - Math.abs(t - 0.5) * 2) + (Math.random() - 0.5) * 0.1);
    }
    const mockWave = new Float32Array(64);
    for (let i = 0; i < 64; i++) mockWave[i] = Math.sin(2 * Math.PI * i / 64) * 0.8;

    await page.evaluate((freq, wave) => {
      window.__mv.feedMockData(freq, wave);
    }, mockFreq, mockWave);

    // 像素探针：检查 canvas 是否有非背景色的像素
    const probeResult = await page.evaluate(() => window.__mv.pixelProbe('#canvas', { step: 2 }));
    results[vizId] = {
      nonBackgroundRatio: probeResult.nonBackground,
      colors: probeResult.colors,
      w: probeResult.w,
      h: probeResult.h
    };
    console.log(`  像素比例: ${(probeResult.nonBackground * 100).toFixed(1)}%`, `色彩数: ${probeResult.colors}`);

    // 切换调色板（如果有选项）
    if (paletteOpts.length > 1) {
      const nextPalette = paletteOpts[(paletteOpts.indexOf(status.palette) + 1) % paletteOpts.length];
      await page.evaluate(p => {
        window.__mv.setPalette(p);
      }, nextPalette);
      await new Promise(r => setTimeout(r, 50));

      // 再次探针
      const probeResult2 = await page.evaluate(() => window.__mv.pixelProbe('#canvas', { step: 2 }));
      results[`${vizId}-after-palette`] = {
        nonBackgroundRatio: probeResult2.nonBackground,
        colors: probeResult2.colors
      };
      console.log(`  切换调色板后: 比例 ${(probeResult2.nonBackground * 100).toFixed(1)}%, 色彩 ${probeResult2.colors}`);
    }
  }

  // 检查控制台错误
  const warningErrors = consoleMessages.filter(m => m.type === 'warning' || m.type === 'error');
  console.log(`\n⚠️  控制台 ${consoleMessages.length} 条消息 (警告/错误: ${warningErrors.length})`);

  // 检查网络请求
  console.log(`\n🌐 外部网络请求: ${hasExternalRequest ? '有（失败）' : '无（本地-only）'}`);

  // 导出截图
  for (const vizId of vizIds) {
    await page.evaluate(id => {
      window.__mv.startDrive();
    }, vizId);
    await new Promise(r => setTimeout(r, 800)); // 让一帧渲染
    const screenshot = await page.screenshot({ path: `verify-${vizId}.png`, fromSurface: 'window' });
    results[`${vizId}-screenshot`] = { path: `verify-${vizId}.png`, size: screenshot.length };
    console.log(`  截图已保存: verify-${vizId}.png (${screenshot.length} bytes)`);
  }

  // 最终状态核对
  const finalStatus = await page.evaluate(() => window.__mv.status());
  console.log('\n📋 最终状态:', JSON.stringify(finalStatus, null, 2));

  // 小结
  console.log('\n===== 验证小结 =====');
  let allOk = true;
  for (const vizId of vizIds) {
    const r = results[vizId];
    const ok = r && r.nonBackgroundRatio > 0.05; // 超过 5% 非背景色即算有内容
    if (!ok) allOk = false;
    console.log(`  ${vizId}: ${ok ? '✅' : '❌'} 非背景色比例 ${(r?.nonBackgroundRatio * 100).toFixed(1)}%`);
  }
  console.log(`\n${allOk ? '全部验证通过' : '部分验证未通过'}`);

  await browser.close();
})();