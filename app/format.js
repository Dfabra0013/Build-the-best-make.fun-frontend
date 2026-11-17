/* Pure formatting helpers — money, time, countdowns, text. No DOM. */
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdPadded = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('en-US');
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/* cents: 'auto' keeps whole dollars for big sums and shows cents for small ones,
   always: always two decimals (ledgers, prize tables) */
export function money(v, { cents = 'auto' } = {}) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (cents === 'always') return usdPadded.format(n);
  if (cents === true || cents === 'auto') return Math.abs(n) < 10 ? usdPadded.format(n) : usd.format(n);
  return usd.format(n);
}
export function count(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return num.format(Number(v));
}
export function compactNum(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return compact.format(Number(v));
}
export function pct(v, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return (Number(v) * 100).toFixed(digits) + '%';
}

/** "in 2h 11m" / "3d 4h ago" style relative label. */
export function relativeTime(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const s = Math.round((t - now) / 1000);
  const abs = Math.abs(s);
  const [n, unit] = abs < 60 ? [abs, 's'] : abs < 3600 ? [Math.round(abs / 60), 'm'] : abs < 86400 ? [Math.round(abs / 3600), 'h'] : [Math.round(abs / 86400), 'd'];
  return s >= 0 ? `in ${n}${unit}` : `${n}${unit} ago`;
}

/** Compact countdown parts for live ticking: {d,h,m,s,urgent,done}. */
export function countdownParts(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return { d: 0, h: 0, m: 0, s: 0, urgent: false, done: true };
  let ms = t - now;
  const done = ms <= 0;
  if (done) ms = 0;
  const s = Math.floor(ms / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
    urgent: !done && ms < 6 * 3600 * 1000,
    done,
  };
}

export function countdownText(iso, now = Date.now()) {
  const p = countdownParts(iso, now);
  if (p.done) return 'ended';
  if (p.d > 0) return `${p.d}d ${p.h}h left`;
  if (p.h > 0) return `${p.h}h ${String(p.m).padStart(2, '0')}m left`;
  return `${p.m}m ${String(p.s).padStart(2, '0')}s left`;
}

/* 803.5 → "$804", 12480 → "$12.5k": short money for tiles and cards */
export function compactUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return '$' + (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
/* the fees that joined the pot: live pot minus the base rewards still on offer */
export function feeShareOf(pot, baseTotal) {
  const p = Number(pot) || 0;
  const b = Number(baseTotal) || 0;
  return b > 0 && p > b ? p - b : 0;
}

export function dateLabel(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  return new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function dateLong(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  return new Date(t).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function truncate(text, max = 140) {
  if (!text) return '';
  const t = String(text).replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}
export function initials(name) {
  const parts = String(name || '?').replace(/^@/, '').split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** Escape a URL for an href/src attribute. */
export function escUrl(u) {
  const s = String(u ?? '');
  if (/^(https?:|mailto:)/i.test(s) || s.startsWith('/') || s.startsWith('#')) return esc(s);
  return '#';
}
