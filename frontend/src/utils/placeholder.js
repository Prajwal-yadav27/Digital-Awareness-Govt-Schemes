function xmlEscape(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  }[c]));
}

function shade(hex, percent) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const adj = (c) => {
    let v = parseInt(c, 16) + Math.round(2.55 * percent);
    v = Math.max(0, Math.min(255, v));
    return v.toString(16).padStart(2, '0');
  };
  return '#' + adj(m[1]) + adj(m[2]) + adj(m[3]);
}

const CATEGORY_COLORS = {
  Education: '#1d4ed8',
  Healthcare: '#059669',
  Health: '#059669',
  Agriculture: '#15803d',
  Finance: '#b45309',
  Financial: '#b45309',
  'Women & Child': '#be185d',
  'Housing & Urban': '#7c3aed',
  Employment: '#0e7490',
  'Social Welfare': '#9333ea',
  Transport: '#0369a1',
  Infrastructure: '#475569',
  Technology: '#2563eb',
  Sports: '#db2777',
  Default: '#0f766e'
};

const CATEGORY_ICON = {
  Education: '🎓',
  Healthcare: '🏥',
  Health: '🏥',
  Agriculture: '🌾',
  Finance: '💰',
  Financial: '💰',
  'Women & Child': '👩',
  'Housing & Urban': '🏘️',
  Employment: '💼',
  'Social Welfare': '🤝',
  Transport: '🚌',
  Infrastructure: '🏗️',
  Technology: '💡',
  Sports: '🏆',
  Default: '🏛️'
};

function wrapLines(text, maxChars) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (line && (line + ' ' + w).length > maxChars) {
      lines.push(line);
      line = w;
      if (lines.length === 2) break;
    } else {
      line = (line ? line + ' ' : '') + w;
    }
  }
  if (line && lines.length < 2) lines.push(line);
  if (lines.length === 2 && words.join(' ').length > lines.join(' ').length) {
    lines[1] = lines[1].slice(0, maxChars - 1) + '…';
  }
  return lines.length ? lines : [' '];
}

export function coverPlaceholder({ title = '', category = '', state = '', sourceType = '', type = 'scheme' } = {}) {
  const isEvent = type === 'event';
  const base = CATEGORY_COLORS[category] || (isEvent ? '#6d28d9' : CATEGORY_COLORS.Default);
  const icon = CATEGORY_ICON[category] || (isEvent ? '📅' : CATEGORY_ICON.Default);
  const label = isEvent ? 'GOVT EVENT' : 'GOVT SCHEME';
  const srcTag = sourceType ? String(sourceType).toUpperCase() : (isEvent ? 'PUBLIC' : '');
  const subtitle = [category, state].filter(Boolean).join('  •  ');
  const lines = wrapLines(title, 24);
  const titleSvg = lines
    .map((ln, i) => `<tspan x='320' dy='${i === 0 ? 0 : 36}'>${xmlEscape(ln)}</tspan>`)
    .join('');
  const escSub = xmlEscape(subtitle);
  const escLabel = xmlEscape(label);
  const escSrc = xmlEscape(srcTag);

  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400' viewBox='0 0 640 400'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${base}'/><stop offset='1' stop-color='${shade(base, -28)}'/>` +
    `</linearGradient></defs>` +
    `<rect width='640' height='400' fill='url(#g)'/>` +
    `<circle cx='320' cy='150' r='54' fill='rgba(255,255,255,0.16)'/>` +
    `<text x='320' y='150' font-size='56' text-anchor='middle' dominant-baseline='central'>${icon}</text>` +
    `<text x='320' y='${400 - 96 - (lines.length - 1) * 18}' font-size='30' font-weight='700' fill='#ffffff' text-anchor='middle' font-family='Segoe UI, Arial, sans-serif'>${titleSvg}</text>` +
    (escSub ? `<text x='320' y='${400 - 52}' font-size='17' fill='rgba(255,255,255,0.85)' text-anchor='middle' font-family='Segoe UI, Arial, sans-serif'>${escSub}</text>` : '') +
    `<text x='320' y='34' font-size='13' letter-spacing='2' fill='rgba(255,255,255,0.8)' text-anchor='middle' font-family='Segoe UI, Arial, sans-serif'>${escLabel}${escSrc ? '  •  ' + escSrc : ''}</text>` +
    `</svg>`;

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export default coverPlaceholder;
