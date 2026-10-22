/**
 * palette.js —— 配色方案（纯函数，零浏览器依赖）
 *
 * 坑记录：最初版本只认 #rrggbb，一旦选"随机"生成 hsl() 字符串，
 * hexToRgb 就会 parseInt 出 NaN，颜色变成 rgba(NaN,NaN,NaN) → 画面全黑。
 * 现在统一走 parseColor，支持 hex 与 hsl 两种写法。
 */

export const Palettes = {
  neon: [
    '#ff006e', '#fb5607', '#ffbe0b', '#8338ec', '#3a86ff',
    '#06ffa5', '#ff006e', '#fb5607', '#ffbe0b', '#8338ec'
  ],
  sunset: [
    '#ff4e50', '#fc913a', '#f9d423', '#6bcb77', '#4d96ff',
    '#ff4e50', '#fc913a', '#f9d423', '#6bcb77', '#4d96ff'
  ],
  ocean: [
    '#0077b6', '#0096c7', '#00b4d8', '#90e0ef', '#caf0f8',
    '#0077b6', '#0096c7', '#00b4d8', '#90e0ef', '#caf0f8'
  ],
  mono: [
    '#ffffff', '#e0e0e0', '#c0c0c0', '#a0a0a0', '#808080',
    '#606060', '#404040', '#202020', '#101010', '#000000'
  ],
};

export const PALETTE_NAMES = ['neon', 'sunset', 'ocean', 'mono', 'random'];

/**
 * 解析颜色 → [r,g,b]
 * 支持：#rgb / #rrggbb / rgb(r,g,b) / hsl(h,s%,l%)
 */
export function parseColor(color) {
  if (Array.isArray(color)) return color.slice(0, 3);
  if (typeof color !== 'string') return [255, 255, 255];

  const s = color.trim();

  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return [255, 255, 255];
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return [255, 255, 255];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  let m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(',').map(p => parseFloat(p));
    if (parts.length >= 3 && parts.every(p => !Number.isNaN(p))) return parts.slice(0, 3);
    return [255, 255, 255];
  }

  m = s.match(/^hsla?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(',').map(p => parseFloat(p));
    if (parts.length >= 3 && parts.every(p => !Number.isNaN(p))) {
      return hslToRgb(parts[0], parts[1] / 100, parts[2] / 100);
    }
    return [255, 255, 255];
  }

  return [255, 255, 255];
}

/** HSL → RGB（h 度，s/l ∈ 0~1） */
export function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; }
  else if (hue < 120) { r = x; g = c; }
  else if (hue < 180) { g = c; b = x; }
  else if (hue < 240) { g = x; b = c; }
  else if (hue < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/** 兼容旧调用名 */
export function hexToRgb(hex) {
  return parseColor(hex);
}

/** 取配色数组；'random' 每次生成一个随机三色渐变 */
export function getPalette(name, rng = Math.random) {
  if (name === 'random') {
    return Array.from({ length: 5 }, () => {
      const h = Math.floor(rng() * 360);
      return `hsl(${h}, 70%, 55%)`;
    });
  }
  return (Palettes[name] || Palettes.neon).slice();
}

/** 在配色数组上按 0~1 位置插值取色 */
export function samplePalette(palette, t) {
  const colors = Array.isArray(palette) ? palette : getPalette(palette);
  if (!colors || colors.length === 0) return '#ffffff';
  const idx = Math.max(0, Math.min(1, t)) * (colors.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  const c1 = parseColor(colors[i % colors.length]);
  const c2 = parseColor(colors[(i + 1) % colors.length]);
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * f),
    Math.round(c1[1] + (c2[1] - c1[1]) * f),
    Math.round(c1[2] + (c2[2] - c1[2]) * f),
  ];
}

/** 生成 count 个颜色的 RGB 数组 */
export function getPaletteColors(palette, count) {
  const colors = Array.isArray(palette) ? palette : getPalette(palette);
  return Array.from({ length: count }, (_, i) => samplePalette(colors, count <= 1 ? 0 : i / (count - 1)));
}

/** RGB → rgba() 字符串 */
export function rgba(rgb, alpha = 1) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}
