/* make.fun frontend — hash router + app bootstrap.
   Routes: #/ board · #/bounty/:slug · #/bounty/:slug/leaderboard · #/u/:handle · #/rankings
   window.__shotReady flips false while a route loads, true once rendered. */
import * as api from './api.js';
import * as v from './views.js';
import { countdownText, esc } from './format.js';

const view = document.getElementById('view');
const meta = document.getElementById('topbar-meta');
const footNote = document.getElementById('foot-note');
let routeToken = 0;
let tickTimer = null;
let boardState = { items: [], query: '', category: 'All', sort: 'pot' };

function parseRoute() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { name: 'board' };
  if (parts[0] === 'rankings') return { name: 'rankings' };
  if (parts[0] === 'bounty' && parts[1]) {
    return parts[2] === 'leaderboard' ? { name: 'leaderboard', slug: parts[1] } : { name: 'bounty', slug: parts[1] };
  }
  if (parts[0] === 'u' && parts[1]) return { name: 'profile', handle: parts[1] };
  return { name: 'board' };
}

function setNav(route) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = (a.dataset.nav === 'board' && route.name === 'board') || (a.dataset.nav === 'rankings' && route.name === 'rankings');
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}
function setMeta(state, label) {
  const dot = state === 'live' ? '' : state === 'stale' ? 'stale' : 'down';
  meta.innerHTML = `<span class="dot ${dot}" aria-hidden="true"></span><span>${esc(label)}</span>`;
}
function ready() {
  window.__shotReady = true;
  view.setAttribute('aria-busy', 'false');
}
function loading() {
  window.__shotReady = false;
  view.setAttribute('aria-busy', 'true');
}
function startTicks() {
  stopTicks();
  tickTimer = setInterval(() => {
    document.querySelectorAll('span.count[data-deadline]').forEach((el) => {
      const text = countdownText(el.dataset.deadline);
      if (el.textContent === text) return;
      el.textContent = text;
      el.classList.toggle('urgent', /^\s*\d+[hms]/.test(text) && !text.startsWith('ended'));
    });
  }, 1000);
}
function stopTicks() { if (tickTimer) clearInterval(tickTimer); tickTimer = null; }

async function renderBoard(token) {
  view.innerHTML = v.skeletonCards(6);
  const { data, stale } = await api.board('?status=open&limit=60');
  if (token !== routeToken) return;
  const { items } = api.pageItems(data);
  boardState.items = items;
  setMeta(stale ? 'stale' : 'live', stale ? 'cached · live API unreachable' : 'live · make.fun API');
  footNote.textContent = `${items.length} bounties · updated ${new Date().toLocaleTimeString()}`;
  view.innerHTML = v.boardView({ items, total: items.length, ...boardState });
  wireBoard();
  ready();
}
function wireBoard() {
  const grid = view.querySelector('[data-grid]');
  const q = view.querySelector('#q');
  const sort = view.querySelector('#sort');
  const apply = () => {
    const query = (q.value || '').toLowerCase();
    const cat = boardState.category;
    let items = boardState.items.filter((b) => {
      const hay = `${b.title} ${b.summary} ${b.description} ${(b.skills || []).join(' ')} ${b.sponsor?.name || ''}`.toLowerCase();
      return (!query || hay.includes(query)) && (cat === 'All' || b.category === cat);
    });
    const by = {
      pot: (a, b) => (v.potOf(b) || 0) - (v.potOf(a) || 0),
      deadline: (a, b) => Date.parse(v.deadlineOf(a) || '2999') - Date.parse(v.deadlineOf(b) || '2999'),
      entries: (a, b) => (v.entriesOf(b) || 0) - (v.entriesOf(a) || 0),
      new: (a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0),
    }[boardState.sort] || (() => 0);
    items = [...items].sort(by);
    grid.innerHTML = items.map((b) => v.bountyCard(b)).join('') || v.emptyHtml('No bounties match', 'Try a different search or category.');
    view.querySelector('[data-count]').textContent = `${items.length} bounties`;
  };
  q.addEventListener('input', () => { boardState.query = q.value; apply(); });
  sort.addEventListener('change', () => { boardState.sort = sort.value; apply(); });
  view.querySelectorAll('[data-cat]').forEach((btn) => btn.addEventListener('click', () => {
    boardState.category = btn.dataset.cat;
    view.querySelectorAll('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
    apply();
  }));
}

async function renderBounty(token, slug) {
  view.innerHTML = `<div class="panel"><div class="skel" style="height:26px;width:55%"></div><div class="skel" style="height:16px;width:90%;margin-top:12px"></div><div class="skel" style="height:16px;width:75%;margin-top:8px"></div></div>`;
  const [bountyRes, reqRes] = await Promise.allSettled([api.bounty(slug), api.bountyRequirements(slug)]);
  if (token !== routeToken) return;
  if (bountyRes.status === 'rejected') throw bountyRes.reason;
  const b = bountyRes.value.data;
  const requirements = reqRes.status === 'fulfilled' ? reqRes.value.data : null;
  setMeta(bountyRes.value.stale ? 'stale' : 'live', bountyRes.value.stale ? 'cached' : 'live · make.fun API');
  view.innerHTML = v.bountyView(b, requirements);
  ready();
}

async function renderLeaderboard(token, slug) {
  view.innerHTML = `<div class="panel"><div class="skel" style="height:22px;width:45%"></div>${'<div class="skel" style="height:34px;width:100%;margin-top:10px"></div>'.repeat(6)}</div>`;
  const [{ data, stale }, bountyRes] = await Promise.all([
    api.leaderboard(slug),
    api.bounty(slug).catch(() => null),
  ]);
  if (token !== routeToken) return;
  setMeta(stale ? 'stale' : 'live', stale ? 'cached' : 'live · make.fun API');
  const prizes = bountyRes?.data?.rewardsNow || null;
  view.innerHTML = v.leaderboardView(data, slug, prizes);
  ready();
}

async function renderProfile(token, handle) {
  view.innerHTML = `<div class="panel"><div class="skel" style="height:84px;width:84px;border-radius:24px"></div><div class="skel" style="height:26px;width:40%;margin-top:14px"></div><div class="skel" style="height:16px;width:70%;margin-top:10px"></div></div>`;
  const { data, stale } = await api.profile(handle);
  if (token !== routeToken) return;
  setMeta(stale ? 'stale' : 'live', stale ? 'cached' : 'live · make.fun API');
  view.innerHTML = v.profileView(data);
  ready();
}

async function renderRankings(token) {
  view.innerHTML = `<div class="panel">${'<div class="skel" style="height:34px;width:100%;margin-top:10px"></div>'.repeat(6)}</div>`;
  const { data, stale } = await api.rankings('?limit=50');
  if (token !== routeToken) return;
  setMeta(stale ? 'stale' : 'live', stale ? 'cached' : 'live · make.fun API');
  view.innerHTML = v.rankingsView(data);
  ready();
}

async function route() {
  const token = ++routeToken;
  const r = parseRoute();
  setNav(r);
  loading();
  stopTicks();
  try {
    if (r.name === 'board') await renderBoard(token);
    else if (r.name === 'bounty') await renderBounty(token, r.slug);
    else if (r.name === 'leaderboard') await renderLeaderboard(token, r.slug);
    else if (r.name === 'profile') await renderProfile(token, r.handle);
    else if (r.name === 'rankings') await renderRankings(token);
    startTicks();
    setTitle(r);
  } catch (err) {
    if (token !== routeToken) return;
    setMeta('down', 'API unreachable');
    view.innerHTML = v.errorHtml(err, r.name);
    ready();
  }
  view.querySelector('[data-retry]')?.addEventListener('click', () => route());
}

/* each surface has its own URL, so each carries its own title */
function setTitle(r) {
  const base = 'make.fun';
  const map = {
    board: `${base} — live bounty board`,
    rankings: `Global rankings — ${base}`,
    bounty: `Bounty — ${base}`,
    leaderboard: `Leaderboard — ${base}`,
    profile: `Profile — ${base}`,
  };
  const title = view.querySelector('h1')?.textContent?.trim();
  document.title = title ? `${title} — ${base}` : map[r.name] || `${base} — live bounty board`;
}

window.addEventListener('hashchange', route);
route();
