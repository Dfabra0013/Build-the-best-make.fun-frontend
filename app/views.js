/* View renderers for the four surfaces: board, bounty, leaderboard, profile.
   Each returns an HTML string; data comes from api.js. No framework. */
import { money, count, compactNum, compactUsd, feeShareOf, relativeTime, countdownText, dateLabel, dateLong, truncate, initials, esc, escUrl } from './format.js';
import { pick, pageItems } from './api.js';

export const SITE = 'https://make.fun';
export const bountyHref = (slug) => `#/bounty/${encodeURIComponent(slug)}`;
export const boardHref = (slug) => `#/bounty/${encodeURIComponent(slug)}/leaderboard`;
export const profileHref = (handle) => `#/u/${encodeURIComponent(handle)}`;

/* ── shared bits ──────────────────────────────────────────────────────── */
export function statusPill(status, accepting) {
  const s = String(status || '').toLowerCase();
  if (accepting === false || s === 'closed' || s === 'ended' || s === 'finalized') return '<span class="pill ended">Closed</span>';
  if (s === 'open' || s === 'live' || s === 'active') return '<span class="pill live">● Open</span>';
  if (s === 'opening' || s === 'upcoming' || s === 'scheduled') return '<span class="pill soon">◷ Opening soon</span>';
  return `<span class="pill">${esc(status || '—')}</span>`;
}
/* avatars arrive as { url }, an absolute https URL, or a relative /api/avatars/… path */
export function avatarUrl(image, small = false) {
  const raw = image && typeof image === 'object' ? (small ? image.url_small || image.url : image.url) : image;
  if (!raw) return null;
  const str = String(raw);
  return /^https?:/i.test(str) ? str : SITE + (str.startsWith('/') ? str : '/' + str);
}
export function avatarImg(image, name, size = 30) {
  const url = avatarUrl(image, size <= 30);
  if (url) return `<img src="${escUrl(url)}" alt="" width="${size}" height="${size}" loading="lazy" crossorigin="anonymous" referrerpolicy="no-referrer">`;
  return `<span class="avatar-fallback" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px;border-radius:${size > 60 ? 24 : 50}%" aria-hidden="true">${esc(initials(name))}</span>`;
}
export function sponsorHtml(sponsor) {
  if (!sponsor) return '';
  const name = pick(sponsor, 'name', 'slug') || 'make.fun';
  const logo = pick(sponsor, 'logo', 'image', 'avatar');
  const verified = sponsor.isVerified ? ' ✓' : '';
  return `<span class="sponsor">${logo ? `<img src="${escUrl(logo)}" alt="" loading="lazy" crossorigin="anonymous" referrerpolicy="no-referrer">` : ''}by ${esc(name)}${verified}</span>`;
}
export function feeOf(bounty, requirements) {
  const direct = pick(bounty, 'entry_fee', 'entryFee', 'fee', 'entryFeeUsd', 'feeUsd');
  if (direct !== undefined) {
    const n = Number(typeof direct === 'object' ? pick(direct, 'amount_usd', 'amount', 'usd') : direct);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  const fee = requirements?.entry_fee;
  if (fee) {
    const n = Number(pick(fee, 'amount_usd', 'amount', 'usd'));
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
}
export function potOf(bounty) {
  // potUsd is the live pot (base reward + entry fees); rewardAmount is the base.
  const v = pick(bounty, 'potUsd', 'pot_usd', 'rewardAmount', 'reward_amount', 'pot', 'prize', 'total_usd', 'amount');
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
export function entriesOf(bounty) {
  const v = pick(bounty, 'submissionCount', 'submission_count', 'entries', 'entries_count', 'agentCount', 'agents');
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
export function deadlineOf(bounty) {
  return pick(bounty, 'deadline', 'entries_close', 'closes_at', 'ends_at', 'deadline_at') || null;
}
export function skeletonCards(n = 6) {
  return `<div class="grid" aria-hidden="true">${Array.from({ length: n }, () => '<div class="card"><div class="skel" style="height:20px;width:70%"></div><div class="skel" style="height:14px;width:100%"></div><div class="skel" style="height:14px;width:85%"></div><div class="skel" style="height:26px;width:55%"></div></div>').join('')}</div>`;
}
export function errorHtml(err, retry) {
  const msg = err?.message || 'Something went wrong.';
  return `<div class="state"><div class="err" role="alert"><b>Couldn't load live data.</b><br>${esc(msg)}</div><button class="btn ghost" data-retry="${esc(retry || '')}">Retry</button></div>`;
}
export function emptyHtml(title, sub) {
  return `<div class="empty"><h2 style="margin:0 0 6px">${esc(title)}</h2><p style="margin:0">${esc(sub)}</p></div>`;
}

/* ── 1 · bounty board ─────────────────────────────────────────────────── */
export function boardView({ items, total, query, category, sort }) {
  const cards = items.map((b) => bountyCard(b)).join('');
  const cats = ['All', ...new Set(items.map((b) => b.category).filter(Boolean))];
  return `
  <section class="hero">
    <div>
      <h1>The live <span class="grad">bounty board</span></h1>
      <p class="hero-sub">Every open make.fun bounty with its live pot, entry fee, time left and entries — straight from the public API. Click any bounty for its rules, rewards and leaderboard.</p>
    </div>
    <div class="hero-stats" aria-label="Board totals">
      <div class="stat hot"><b data-stat="pot">${money(items.reduce((a, b) => a + (potOf(b) || 0), 0))}</b><span>live pot</span></div>
      <div class="stat"><b data-stat="open">${count(items.filter((b) => String(b.status).toLowerCase() === 'open').length)}</b><span>open</span></div>
      <div class="stat"><b data-stat="agents">${count(items.reduce((a, b) => a + (entriesOf(b) || 0), 0))}</b><span>entries</span></div>
    </div>
  </section>
  <div class="toolbar" role="search">
    <label class="search"><span aria-hidden="true">⌕</span><input id="q" type="search" placeholder="Search bounties, skills, sponsors…" value="${esc(query)}" aria-label="Search bounties"></label>
    <div class="chiprow" role="group" aria-label="Category">
      ${cats.map((c) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${c === category}">${esc(c)}</button>`).join('')}
    </div>
    <label class="small muted" for="sort">Sort</label>
    <select class="select" id="sort" aria-label="Sort bounties">
      ${[['pot', 'Biggest pot'], ['deadline', 'Ending soonest'], ['entries', 'Most entries'], ['new', 'Newest']].map(([v, l]) => `<option value="${v}"${v === sort ? ' selected' : ''}>${l}</option>`).join('')}
    </select>
  </div>
  <p class="small muted" data-count>${count(items.length)} ${total && total !== items.length ? `of ${count(total)}` : ''} bounties</p>
  <div class="grid" data-grid>${cards || ''}</div>
  ${items.length ? '' : emptyHtml('No bounties match', 'Try a different search or category.')}
  `;
}

export function bountyCard(b) {
  const slug = b.slug || '';
  const pot = potOf(b);
  const fee = feeOf(b);
  const entries = entriesOf(b);
  const deadline = deadlineOf(b);
  const skills = Array.isArray(b.skills) ? b.skills.slice(0, 4) : [];
  return `
  <a class="card" href="${bountyHref(slug)}" data-slug="${esc(slug)}" data-cat="${esc(b.category || '')}" data-pot="${pot ?? 0}" data-closes="${esc(deadline || '')}" data-entries="${entries ?? 0}" data-published="${esc(b.publishedAt || '')}">
    <div class="card-top">
      <div style="min-width:0;flex:1">
        <h2>${esc(b.title || slug)}</h2>
        ${sponsorHtml(b.sponsor)}
      </div>
      <div class="pot"><b>${compactUsd(pot)}</b><span>live pot</span></div>
    </div>
    <p class="card-desc">${esc(truncate(b.summary || b.description || '', 150))}</p>
    ${skills.length ? `<div class="skills">${skills.map((s) => `<span class="skill">${esc(s)}</span>`).join('')}</div>` : ''}
    <div class="card-foot">
      ${statusPill(b.status, b.acceptingSubmissions)}
      ${b.category ? `<span class="pill cat">${esc(b.category)}</span>` : ''}
      ${fee ? `<span class="pill fee">$${fee.toFixed(2)} to enter</span>` : ''}
      ${entries !== null ? `<span class="pill">${count(entries)} entries</span>` : ''}
      ${deadline ? `<span class="count" data-deadline="${esc(deadline)}">${esc(countdownText(deadline))}</span>` : ''}
    </div>
  </a>`;
}

/* ── 2 · bounty page ──────────────────────────────────────────────────── */
function ordinal(n) {
  const k = Number(n) % 100;
  if (k >= 11 && k <= 13) return n + 'th';
  return n + (['th', 'st', 'nd', 'rd'][Number(n) % 10] || 'th');
}

export function bountyView(b, requirements) {
  const slug = b.slug || '';
  const pot = potOf(b);
  const fee = feeOf(b, requirements);
  const entries = entriesOf(b);
  const deadline = deadlineOf(b);
  const rewardsNow = Array.isArray(b.rewardsNow) ? b.rewardsNow : null;
  const rewards = rewardsNow
    ? rewardsNow.map((r) => [String(r.place), Number(r.amountUsd ?? r.amount ?? 0)])
    : (b.rewards && typeof b.rewards === 'object' ? Object.entries(b.rewards) : []);
  const paid = rewards.length;
  const top = rewards.length ? Math.max(...rewards.map((r) => Number(r[1]) || 0)) : 0;
  const total = rewards.reduce((a, r) => a + (Number(r[1]) || 0), 0);
  const phases = Array.isArray(b.phases) ? b.phases : [];
  const desc = b.description || b.summary || '';
  return `
  <nav class="crumb" aria-label="Breadcrumb"><a href="#/">Board</a> / <span aria-current="page">${esc(b.title || slug)}</span></nav>
  <div class="bhead" style="margin-top:10px">
    <div class="grow">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${statusPill(b.status, b.acceptingSubmissions)}
        ${b.category ? `<span class="pill cat">${esc(b.category)}</span>` : ''}
        ${fee ? `<span class="pill fee">$${fee.toFixed(2)} entry fee</span>` : ''}
        ${b.harnessKind ? `<span class="pill">${esc(b.harnessKind)}</span>` : ''}
      </div>
      <h1>${esc(b.title || slug)}</h1>
      <div style="margin-top:2px">${sponsorHtml(b.sponsor)}</div>
    </div>
    <div class="bpot" aria-label="Live pot">
      <span>Live pot</span>
      <b>${compactUsd(pot)}</b>
      ${deadline ? `<span class="pot-left"><span class="count" data-deadline="${esc(deadline)}">${esc(countdownText(deadline))}</span></span>` : ''}
      <span class="small muted">${deadline ? `ends ${esc(dateLabel(deadline))}` : ''}${entries !== null ? ` · ${count(entries)} entries` : ''}</span>
    </div>
  </div>
  <div class="facts" aria-label="Bounty facts">
    <div class="fact hot"><span>Live pot</span><b>${compactUsd(pot)}</b><i>${b.entryFeesUsd && Number(b.entryFeesUsd) > 0 ? money(Number(b.entryFeesUsd)) + ' from entry fees' : feeShareOf(pot, total) ? money(feeShareOf(pot, total)) + ' from entry fees' : 'base rewards'}</i></div>
    <div class="fact"><span>Entry fee</span><b>${fee ? '$' + fee.toFixed(2) : 'Free'}</b><i>paid once per account</i></div>
    <div class="fact"><span>Paid places</span><b>${paid || '—'}</b><i>${total ? money(total) + ' now on offer' : 'top places share the pot'}</i></div>
    <div class="fact"><span>Next prize</span><b>${top ? compactUsd(top) : '—'}</b><i>for first place</i></div>
    <div class="fact"><span>Entries</span><b>${entries !== null ? count(entries) : '—'}</b><i>${b.entryFeePayers ? count(b.entryFeePayers) + ' paid the fee' : 'agents entered'}</i></div>
    <div class="fact"><span>Time left</span><b class="count"${deadline ? ` data-deadline="${esc(deadline)}"` : ''}>${deadline ? esc(countdownText(deadline)) : '—'}</b><i>${deadline ? 'closes ' + esc(dateLabel(deadline)) : 'no deadline'}</i></div>
  </div>
  <div class="tabs" role="tablist" aria-label="Bounty sections">
    <a href="${bountyHref(slug)}" aria-current="page">Overview</a>
    <a href="${boardHref(slug)}">Leaderboard</a>
    <a href="${SITE}/bounty/${encodeURIComponent(slug)}" target="_blank" rel="noopener">On make.fun ↗</a>
  </div>
  <div class="cols">
    <div class="panel">
      <h2>About this bounty</h2>
      <div class="prose">${renderMarkdown(desc)}</div>
      ${b.rules ? `<h3 style="margin-top:18px">Rules</h3><div class="prose">${renderMarkdown(b.rules)}</div>` : ''}
    </div>
    <aside>
      <div class="panel">
        <h2>Rewards now</h2>
        ${rewards.length ? `<table class="rewards"><tbody>
          ${rewards.slice(0, 10).map(([place, amount], i) => `<tr><td class="c-rank"><span class="medal m${i + 1}">${esc(place)}</span></td><td>${i === 0 ? 'First place' : i === 1 ? 'Second place' : i === 2 ? 'Third place' : `${ordinal(place)} place`}</td><td class="score">${money(Number(amount), { cents: 'always' })}</td></tr>`).join('')}
        </tbody></table>
        ${paid > 10 ? `<p class="small muted" style="margin:10px 0 0">Places 11–${paid} pay ${money(Number(rewards[10][1]), { cents: 'always' })} each.</p>` : ''}
        <p class="small muted" style="margin:10px 0 0">Every entry fee joins the pot, so these grow until the deadline.</p>` : '<p class="muted">Rewards are listed on make.fun.</p>'}
      </div>
      ${phases.length ? `<div class="panel"><h2>Phases</h2><table><tbody>
        ${phases.map((p) => `<tr><td>${esc(p.title || p.key || '—')}</td><td class="small muted">${esc(p.starts_at || p.startsAt ? dateLabel(p.starts_at || p.startsAt) : '—')} → ${esc(p.ends_at || p.endsAt ? dateLabel(p.ends_at || p.endsAt) : '—')}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
    </aside>
  </div>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
    <a class="btn" href="${boardHref(slug)}">View leaderboard →</a>
    <a class="btn ghost" href="${SITE}/bounty/${encodeURIComponent(slug)}" target="_blank" rel="noopener">Enter on make.fun ↗</a>
  </div>`;
}

/* ── 3 · leaderboard ──────────────────────────────────────────────────── */
export function leaderboardView(data, slug, prizesIn) {
  const comp = data.competition || {};
  const { items } = pageItems(data);
  const rows = items.length ? items : (data.entries || data.rows || []);
  const cols = Array.isArray(data.columns) ? data.columns : [];
  const scoreKey = data.rank_key || data.overall_key || cols.find((c) => !c.hidden)?.key;
  const title = comp.title || slug;
  const prizes = new Map();
  (Array.isArray(prizesIn) ? prizesIn : comp.rewardsNow || data.rewardsNow || [])
    .forEach((r) => prizes.set(Number(r.place), Number(r.amountUsd ?? r.amount ?? 0)));
  const values = rows.map((r) => microOf(r, scoreKey));
  const best = Math.max(0, ...values);
  const worst = Math.min(...values.filter((n) => n > 0));
  /* the bar zooms on the top of the field, and its header states the window */
  const axisLow = Number.isFinite(worst) ? Math.max(0, Math.floor(worst) - 1) : 0;
  const axisHigh = Math.min(100, Math.ceil(best));
  const leader = rows[0] ? (rows[0].handle || rows[0].hunter || '—') : '—';
  return `
  <nav class="crumb" aria-label="Breadcrumb"><a href="#/">Board</a> / <a href="${bountyHref(slug)}">${esc(title)}</a> / <span aria-current="page">Leaderboard</span></nav>
  <div class="hero" style="margin-top:10px">
    <div>
      <h1>${esc(title)} <span class="grad">leaderboard</span></h1>
      <p class="hero-sub">${count(rows.length)} ranked ${rows.length === 1 ? 'entry' : 'entries'} · ranked by ${esc(labelOf(data, scoreKey, cols))} · read live from make.fun's public API.</p>
    </div>
    <div class="hero-stats" aria-label="Leaderboard summary">
      <div class="stat"><b>${esc(data.phase?.key || data.phase || 'dev')}</b><span>phase</span></div>
      <div class="stat hot"><b>${values.length ? Math.max(...values).toFixed(1) + '%' : '—'}</b><span>best score</span></div>
      <div class="stat"><b>${count(rows.filter((r) => r.prize_eligible).length)}</b><span>in the prizes</span></div>
    </div>
  </div>
  <div class="panel lb">
  ${rows.length ? `<table>
    <thead><tr><th class="c-rank">#</th><th>Entry</th><th class="c-score">${esc(labelOf(data, scoreKey, cols))}</th><th class="c-bar">Standing <span class="axis">${axisLow}–${axisHigh}%</span></th><th class="c-prize">Prize</th></tr></thead>
    <tbody>
    ${rows.map((r, i) => leaderboardRow(r, i, scoreKey, axisLow, axisHigh, prizes)).join('')}
    </tbody></table>` : emptyHtml('No ranked entries yet', 'Entries appear here once they are judged.')}
  </div>
  <p class="small muted" style="margin-top:12px">Full board on <a href="${SITE}/bounty/${encodeURIComponent(slug)}/leaderboard" target="_blank" rel="noopener">make.fun ↗</a></p>`;
}

/* judge scores arrive as integers in ten-thousandths: 956066 → 95.6066% */
function microOf(r, key) {
  const raw = Number(r.values?.[key] ?? r.score ?? 0) || 0;
  return raw > 10000 ? raw / 10000 : raw;
}
function labelOf(data, key, cols) {
  const col = cols.find((c) => c.key === key);
  const title = col?.title || data.title || key || 'score';
  return title.replace(/\bwin\s*rate\b/i, 'win rate');
}
function leaderboardRow(r, i, scoreKey, axisLow, axisHigh, prizes) {
  const rank = Number(r.rank ?? i + 1);
  const handle = r.handle || r.hunter || 'unknown';
  const name = r.title || handle;
  const raw = Number(r.values?.[scoreKey] ?? r.score ?? 0) || 0;
  const score = microOf(r, scoreKey);
  const isMicro = isRate(scoreKey) || raw > 10000;
  const scoreText = isMicro ? score.toFixed(1) + '%' : (r.display?.[scoreKey] ?? (score ? String(score) : '—'));
  const ivLow = Number(r.values?.[scoreKey + '_low']);
  const ivHigh = Number(r.values?.[scoreKey + '_high']);
  const interval = isMicro && ivLow && ivHigh ? `${(ivLow / 10000).toFixed(1)}–${(ivHigh / 10000).toFixed(1)}%` : '';
  const span = axisHigh - axisLow;
  const frac = span > 0 ? Math.min(1, Math.max(0.06, (score - axisLow) / span)) : 1;
  const prize = prizes.get(rank);
  const medal = rank <= 3 ? `<span class="medal m${rank}" aria-hidden="true">${rank}</span>` : `<span class="ranknum">${esc(rank)}</span>`;
  const tag = r.house ? '<span class="tag house">house</span>' : !r.prize_eligible ? `<span class="tag">${esc(r.status || '—')}</span>` : '';
  return `<tr class="${rank <= 3 ? 'top' + rank : ''}">
    <td class="c-rank">${medal}</td>
    <td class="c-entry"><a class="who" href="${profileHref(handle)}">${avatarImg(r.image, handle)}<span class="who-text"><span class="name">${esc(truncate(name, 78))}</span><span class="sub">@${esc(handle)} ${tag}</span></span></a></td>
    <td class="c-score"><span class="score">${esc(scoreText)}</span>${interval ? `<span class="iv">${esc(interval)}</span>` : ''}</td>
    <td class="c-bar"><div class="bar" role="img" aria-label="${esc(scoreText)} of the top entry"><i style="width:${Math.round(frac * 100)}%"></i></div></td>
    <td class="c-prize">${prize ? `<span class="prize">${money(prize)}</span>` : '<span class="muted">—</span>'}</td>
  </tr>`;
}

/* ── 4 · public profile ───────────────────────────────────────────────── */
function num(v) {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function isOpen(comp) {
  const status = String(comp.status || '').toLowerCase();
  if (status === 'resolved' || status === 'finished' || status === 'closed') return false;
  const end = Date.parse(comp.deadline || comp.ends_at || '');
  return Number.isNaN(end) ? status === 'open' : end > Date.now();
}
/* a scored row: 956066 micro → "95.6%", plain numbers stay plain */
function microText(value, display, key) {
  const n = Number(value);
  if (!Number.isFinite(n)) return display || '—';
  /* only win-rate columns are scaled in ten-thousandths; other metrics are raw */
  if (isRate(key)) return (n / 10000).toFixed(1) + '%';
  return n.toLocaleString('en-US');
}
function isRate(key) {
  const k = String(key || '').toLowerCase();
  return k === 'judge' || k.includes('rate') || k.includes('win');
}

export function profileView(p) {
  const handle = p.handle || '';
  const name = p.display_name || handle;
  const record = p.record || {};
  const solutions = Array.isArray(p.solutions) ? p.solutions : [];
  const payouts = Array.isArray(p.payouts) ? p.payouts : [];
  const entered = num(record.competitions_entered) ?? solutions.length;
  const won = num(record.competitions_won) ?? 0;
  const placed = num(record.competitions_placed) ?? 0;
  const podiums = num(record.podium_finishes) ?? 0;
  const best = num(record.best_placement);
  const prize = num(record.prize_usd);
  const solved = solutions.filter((x) => x.score).length;
  const live = solutions.filter((x) => x.competition && isOpen(x.competition));
  return `
  <nav class="crumb" aria-label="Breadcrumb"><a href="#/">Board</a> / <span aria-current="page">@${esc(handle)}</span></nav>
  <div class="panel pcard" style="margin-top:10px">
    <div class="phead">
      ${avatarImg(p.image || p.avatar, name, 84)}
      <div style="flex:1;min-width:220px">
        <h1>${esc(name)} ${p.house ? '<span class="tag house">house</span>' : ''}</h1>
        <div class="handle">@${esc(handle)}${p.joined_at ? ` · joined ${esc(dateLabel(p.joined_at))}` : ''}</div>
        ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:8px" class="small">
          ${p.github_login ? `<a href="https://github.com/${encodeURIComponent(p.github_login)}" target="_blank" rel="noopener">GitHub ↗</a>` : ''}
          ${p.x ? `<a href="${escUrl('https://x.com/' + encodeURIComponent(p.x.username || p.x))}" target="_blank" rel="noopener">X ↗</a>` : ''}
          ${p.discord ? `<span class="muted">Discord: ${esc(p.discord.username || '')}</span>` : ''}
          ${p.wallet ? `<span class="mono small">${esc(String(p.wallet.address || '').slice(0, 6))}…${esc(String(p.wallet.address || '').slice(-4))}</span>` : ''}
        </div>
      </div>
    </div>
    <div class="kv pstats">
      <div class="cell hot"><b>${prize !== undefined ? money(prize, { cents: 'always' }) : '—'}</b><span>prize money</span></div>
      <div class="cell"><b>${count(won)}</b><span>wins</span></div>
      <div class="cell"><b>${count(podiums)}</b><span>podiums</span></div>
      <div class="cell"><b>${count(placed)}</b><span>placed</span></div>
      <div class="cell"><b>${count(entered)}</b><span>entered</span></div>
      <div class="cell"><b>${best !== undefined ? '#' + esc(best) : '—'}</b><span>best place</span></div>
    </div>
  </div>
  ${solutions.length ? `<div class="panel">
    <h2>Solutions <span class="muted small" style="font-weight:500">${count(solved)} scored${live.length ? ` · ${count(live.length)} open` : ''}</span></h2>
    <table class="sols"><thead><tr><th>Bounty</th><th>Score</th><th>Place</th></tr></thead><tbody>
    ${solutions.slice(0, 12).map((x) => {
      const comp = x.competition || {};
      const score = x.score ? microText(x.score.value, x.score.display, x.score.column?.key) : '—';
      const title = x.title || comp.title || comp.slug || '—';
      const href = comp.slug ? bountyHref(comp.slug) : null;
      return `<tr>
        <td class="c-entry">${href ? `<a href="${href}">${esc(truncate(title, 74))}</a>` : esc(truncate(title, 74))}
          <span class="sub">${comp.title && x.title ? esc(truncate(comp.title, 52)) + ' · ' : ''}${comp.status ? esc(comp.status) : ''}${comp.pot_usd ? ` · ${money(Number(comp.pot_usd))} pot` : ''}</span></td>
        <td class="score">${esc(score)}</td>
        <td>${x.placement ? `<span class="medal m${x.placement <= 3 ? x.placement : 0}">${esc(x.placement)}</span>` : '<span class="muted">—</span>'}</td>
      </tr>`;
    }).join('')}
    </tbody></table>
    ${solutions.length > 12 ? `<p class="small muted" style="margin:12px 0 0">Showing 12 of ${count(solutions.length)} solutions.</p>` : ''}
  </div>` : ''}
  ${payouts.length ? `<div class="panel"><h2>Payouts</h2><table><thead><tr><th>When</th><th>Amount</th></tr></thead><tbody>
    ${payouts.map((x) => `<tr><td>${esc(x.at || x.created_at ? dateLabel(x.at || x.created_at) : '—')}</td><td class="score">${x.amount_usd !== undefined ? money(Number(x.amount_usd)) : x.amount !== undefined ? money(Number(x.amount)) : '—'}</td></tr>`).join('')}
  </tbody></table></div>` : ''}
  <p class="small muted" style="margin-top:12px">Public profile · <a href="${SITE}/u/${encodeURIComponent(handle)}" target="_blank" rel="noopener">view on make.fun ↗</a></p>`;
}

/* ── 5 · global rankings ─────────────────────────────────────────────── */

export function rankingsView(data) {
  const { items } = pageItems(data);
  const rows = items.length ? items : (data.rankings || data.rows || []);
  const total = num(data.total);
  const order = data.order || 'wins';
  const prize = rows.reduce((a, r) => a + (num(r.record && r.record.prize_usd) || 0), 0);
  return `
  <section class="hero">
    <div>
      <h1>Global <span class="grad">rankings</span></h1>
      <p class="hero-sub">${total ? count(total) + ' accounts' : 'The accounts'} ranked across make.fun, ordered by ${esc(order)} · read live from the public API.</p>
    </div>
    <div class="hero-stats" aria-label="Rankings summary">
      <div class="stat hot"><b>${rows.length ? money(prize) : '—'}</b><span>prizes on this page</span></div>
      <div class="stat"><b>${total ? count(total) : count(rows.length)}</b><span>ranked accounts</span></div>
      <div class="stat"><b>${esc(order)}</b><span>order</span></div>
    </div>
  </section>
  <div class="panel lb" style="padding:4px clamp(8px,1.6vw,16px)">
  ${rows.length ? `<table>
    <thead><tr><th class="c-rank">#</th><th>Account</th><th class="c-num">Wins</th><th class="c-num">Placed</th><th class="c-num">Entered</th><th class="c-prize">Prize money</th></tr></thead>
    <tbody>
    ${rows.map((r, i) => {
      const handle = r.handle || r.username || 'unknown';
      const rank = Number(r.rank ?? r.place ?? i + 1);
      const rec = r.record || {};
      const medal = rank <= 3 ? `<span class="medal m${rank}" aria-hidden="true">${rank}</span>` : `<span class="ranknum">${esc(rank)}</span>`;
      return `<tr class="${rank <= 3 ? 'top' + rank : ''}">
        <td class="c-rank">${medal}</td>
        <td class="c-entry"><a class="who" href="${profileHref(handle)}">${avatarImg(r.image || r.avatar, r.display_name || handle)}<span class="who-text"><span class="name">${esc(r.display_name || handle)}</span><span class="sub">@${esc(handle)}</span></span></a></td>
        <td class="c-num"><b>${count(num(rec.competitions_won) ?? 0)}</b></td>
        <td class="c-num">${count(num(rec.competitions_placed) ?? 0)}</td>
        <td class="c-num muted">${count(num(rec.competitions_entered) ?? 0)}</td>
        <td class="c-prize">${num(rec.prize_usd) ? `<span class="prize">${money(num(rec.prize_usd), { cents: 'always' })}</span>` : '<span class="muted">—</span>'}</td>
      </tr>`;
    }).join('')}
  </tbody></table>` : emptyHtml('No rankings yet', 'Rankings appear once agents compete.')}
  </div>
  <p class="small muted" style="margin-top:12px">Full standings on <a href="${SITE}/rankings" target="_blank" rel="noopener">make.fun ↗</a></p>`;
}

/* ── tiny markdown (safe subset) ──────────────────────────────────────── */
export function renderMarkdown(md) {
  if (!md) return '<p class="muted">No description provided.</p>';
  const lines = String(md).replace(/\r/g, '').split('\n');
  const out = [];
  let list = null; // 'ul' | 'ol' | null
  let para = [];
  let code = null;
  const flushPara = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
  };
  const flushList = () => {
    if (list) { out.push(`</${list}>`); list = null; }
  };
  const flushAll = () => { flushPara(); flushList(); };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (code !== null) {
      if (/^\s*```/.test(line)) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = null; }
      else code.push(raw);
      continue;
    }
    if (/^\s*```/.test(line)) { flushAll(); code = []; continue; }

    if (!line.trim()) { flushAll(); continue; }

    const heading = line.match(/^(#{1,5})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = Math.min(4, heading[1].length) + 1;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushPara();
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) { flushList(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline((bullet || numbered)[1])}</li>`);
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) { flushAll(); out.push(`<blockquote>${inline(quote[1])}</blockquote>`); continue; }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushAll(); out.push('<hr>'); continue; }

    flushList();
    para.push(line.trim());
  }
  if (code !== null) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
  flushAll();
  return out.join('');
}
function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
