/* ===================================================
   TRADOCTORY — JOURNAL PAGE  (journal.js)
   =================================================== */
'use strict';

import { guardRoute, signOutAndRedirect } from './route-guard.js';

/* ── 1. Enforce authentication ───────────────────── */
const user = guardRoute('login.html');
if (!user) throw new Error('Unauthenticated — redirecting.');

/* ── 2. Populate user UI ─────────────────────────── */
const nameEl     = document.getElementById('userDisplayName');
const planEl     = document.getElementById('userDisplayPlan');
const avatarEl   = document.getElementById('userAvatarInitial');
const signOutBtn = document.getElementById('signOutBtn');
const menuToggle = document.getElementById('menuToggle');
const sidebar    = document.getElementById('sidebar');

if (nameEl)   nameEl.textContent   = user.name  ?? user.email;
if (planEl)   planEl.textContent   = user.plan === 'free' ? 'Free plan' : 'Pro plan';
if (avatarEl) avatarEl.textContent = (user.name ?? user.email).charAt(0).toUpperCase();

/* ── 3. Sign out ─────────────────────────────────── */
signOutBtn?.addEventListener('click', () => signOutAndRedirect('index.html'));

/* ── 4. Mobile sidebar toggle ────────────────────── */
menuToggle?.addEventListener('click', () => sidebar?.classList.toggle('open'));

/* ── 5. Journal interactions ─────────────────────── */
const trades = [
  { date: '2026-06-15', market: 'Crypto', symbol: 'BTC/USD', strategy: 'Breakout', direction: 'Long', result: 'Win', pnl: 1240, notes: 'Clean breakout through prior resistance.' },
  { date: '2026-06-14', market: 'Crypto', symbol: 'ETH/USD', strategy: 'Momentum', direction: 'Long', result: 'Win', pnl: 380, notes: 'Followed BTC strength with tight invalidation.' },
  { date: '2026-06-13', market: 'Crypto', symbol: 'SOL/USD', strategy: 'Reversal', direction: 'Short', result: 'Loss', pnl: -95, notes: 'News spike invalidated the short thesis.' },
  { date: '2026-06-12', market: 'Stocks', symbol: 'AAPL', strategy: 'Swing', direction: 'Long', result: 'Open', pnl: 210, notes: 'Pre-earnings swing remains above trend support.' },
  { date: '2026-06-11', market: 'Forex', symbol: 'EUR/USD', strategy: 'Trend', direction: 'Short', result: 'Win', pnl: 620, notes: 'H4 continuation aligned with dollar strength.' },
  { date: '2026-06-10', market: 'Stocks', symbol: 'TSLA', strategy: 'Momentum', direction: 'Long', result: 'Loss', pnl: -320, notes: 'Entered early and failed to respect stop plan.' }
];

const tableBody = document.getElementById('tradeTableBody');
const entryCount = document.getElementById('entryCount');
const emptyState = document.getElementById('emptyState');
const dateFilter = document.getElementById('dateFilter');
const strategyFilter = document.getElementById('strategyFilter');
const resultFilter = document.getElementById('resultFilter');
const marketFilter = document.getElementById('marketFilter');
const resetFilters = document.getElementById('resetFilters');
const addTradeBtn = document.getElementById('addTradeBtn');

function formatDate(value) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function formatCurrency(value) {
  const sign = value >= 0 ? '+' : '−';
  return `${sign}$${Math.abs(value).toLocaleString()}`;
}

function renderTrades() {
  if (!tableBody) return;

  const filteredTrades = trades.filter((trade) => {
    const matchesDate = !dateFilter?.value || trade.date === dateFilter.value;
    const matchesStrategy = strategyFilter?.value === 'all' || trade.strategy === strategyFilter?.value;
    const matchesResult = resultFilter?.value === 'all' || trade.result === resultFilter?.value;
    const matchesMarket = marketFilter?.value === 'all' || trade.market === marketFilter?.value;
    return matchesDate && matchesStrategy && matchesResult && matchesMarket;
  });

  tableBody.innerHTML = filteredTrades.map((trade) => {
    const tagClass = trade.result.toLowerCase();
    const pnlClass = trade.pnl >= 0 ? 'var(--accent)' : 'var(--red)';
    return `
      <tr>
        <td>${formatDate(trade.date)}</td>
        <td>${trade.market}</td>
        <td style="color:var(--text-primary);font-weight:600;">${trade.symbol}</td>
        <td>${trade.strategy}</td>
        <td>${trade.direction}</td>
        <td><span class="tag ${tagClass}">${trade.result.toUpperCase()}</span></td>
        <td style="color:${pnlClass};font-weight:700;">${formatCurrency(trade.pnl)}</td>
        <td style="color:var(--text-muted);font-size:12px;">${trade.notes}</td>
      </tr>
    `;
  }).join('');

  if (entryCount) entryCount.textContent = `${filteredTrades.length} ${filteredTrades.length === 1 ? 'entry' : 'entries'}`;
  if (emptyState) emptyState.hidden = filteredTrades.length > 0;
}

[dateFilter, strategyFilter, resultFilter, marketFilter].forEach((filter) => {
  filter?.addEventListener('change', renderTrades);
});

resetFilters?.addEventListener('click', () => {
  if (dateFilter) dateFilter.value = '';
  if (strategyFilter) strategyFilter.value = 'all';
  if (resultFilter) resultFilter.value = 'all';
  if (marketFilter) marketFilter.value = 'all';
  renderTrades();
});

addTradeBtn?.addEventListener('click', () => {
  addTradeBtn.textContent = 'Trade form coming soon';
  window.setTimeout(() => {
    addTradeBtn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Trade';
  }, 1800);
});

renderTrades();
