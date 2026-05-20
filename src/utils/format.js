export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
export function mad(values) {
  if (!values.length) return 0;
  const med = median(values);
  return median(values.map(v => Math.abs(v - med)));
}
export function formatUsd(value, compact = false) {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (!Number.isFinite(n)) return '$0.00';
  if (compact) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(n);
  if (abs === 0) return '$0.00';
  if (abs >= 1000) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  if (abs >= 1) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  if (abs >= 0.01) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(n);
  if (abs >= 0.0001) return '$' + n.toFixed(6);
  if (abs >= 0.000001) return '$' + n.toFixed(8);
  return '$' + n.toPrecision(4);
}
export function formatSpread(value) {
  const v = Number(value || 0);
  if (v >= 1) return `${v.toFixed(2)}%`;
  if (v >= 0.1) return `${v.toFixed(3)}%`;
  if (v >= 0.01) return `${v.toFixed(4)}%`;
  if (v >= 0.001) return `${v.toFixed(5)}%`;
  return `${v.toFixed(6)}%`;
}
export const escapeHtml = (text='') => String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export const futureTime = mins => new Date(Date.now() + mins * 60000).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
export function minsLabel(mins) { const m=Math.max(0,mins); const h=Math.floor(m/60); const r=m%60; return h?`T-${h}h ${r}m`:`T-${r}m`; }
export const saveLocal = (k,v)=> localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
