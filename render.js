function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
}

function renderGauge({ weeklyPct = 0, sessionPct = 0, label = '' } = {}) {
  const w = clamp01(weeklyPct);
  const s = clamp01(sessionPct);
  const size = 144;
  const wH = Math.round(size * w);
  const sH = Math.round(size * s);
  const fg = lerpColor(0x22c55e, 0xef4444, s);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <defs>
    <clipPath id="r"><rect x="6" y="6" width="${size - 12}" height="${size - 12}" rx="16" ry="16"/></clipPath>
  </defs>
  <rect width="${size}" height="${size}" fill="#0b0d10"/>
  <g clip-path="url(#r)">
    <rect x="0" y="${size - wH}" width="${size}" height="${wH}" fill="#eab308" opacity="0.55"/>
    <rect x="0" y="${size - sH}" width="${size}" height="${sH}" fill="${fg}"/>
  </g>
  <rect x="6" y="6" width="${size - 12}" height="${size - 12}" rx="16" ry="16"
        fill="none" stroke="#1f2937" stroke-width="2"/>
  <text x="${size / 2}" y="${size - 16}" text-anchor="middle"
        font-family="system-ui, sans-serif" font-size="22" font-weight="700"
        fill="#ffffff" stroke="#000" stroke-width="3" paint-order="stroke">${label || Math.round(s * 100) + '%'}</text>
</svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

module.exports = { renderGauge };
