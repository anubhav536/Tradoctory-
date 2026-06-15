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
  { date: '2026-06-15', market: 'Nifty', symbol: 'Nifty ORB', strategy: 'ORB', direction: 'Buy', result: 'Win', pnl: 1240, notes: 'Opening range breakout held above VWAP.' },
  { date: '2026-06-14', market: 'Crypto', symbol: 'BTC/USD', strategy: 'Breakout', direction: 'Buy', result: 'Win', pnl: 380, notes: 'Clean breakout through prior resistance.' },
  { date: '2026-06-13', market: 'BankNifty', symbol: 'BankNifty Pullback', strategy: 'Pullback', direction: 'Sell', result: 'Loss', pnl: -95, notes: 'Pullback failed after a fast reversal candle.' },
  { date: '2026-06-12', market: 'Stock', symbol: 'AAPL', strategy: 'Support Resistance', direction: 'Buy', result: 'Open', pnl: 210, notes: 'Pre-earnings swing remains above trend support.' },
  { date: '2026-06-11', market: 'Forex', symbol: 'EUR/USD', strategy: 'VWAP', direction: 'Sell', result: 'Win', pnl: 620, notes: 'Continuation aligned with dollar strength.' },
  { date: '2026-06-10', market: 'Stock', symbol: 'TSLA', strategy: 'Other', direction: 'Buy', result: 'Loss', pnl: -320, notes: 'Entered early and failed to respect stop plan.' }
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
const topLogTradeBtn = document.getElementById('topLogTradeBtn');
const addTradeFormSection = document.getElementById('addTradeFormSection');
const addTradeForm = document.getElementById('addTradeForm');
const tradeScreenshot = document.getElementById('tradeScreenshot');
const screenshotFileName = document.getElementById('screenshotFileName');
const addTradeStatus = document.getElementById('addTradeStatus');

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

function scrollToAddTradeForm() {
  addTradeFormSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  addTradeForm?.querySelector('input[name="tradeName"]')?.focus({ preventScroll: true });
}

addTradeBtn?.addEventListener('click', scrollToAddTradeForm);
topLogTradeBtn?.addEventListener('click', scrollToAddTradeForm);

tradeScreenshot?.addEventListener('change', () => {
  const file = tradeScreenshot.files?.[0];
  if (screenshotFileName) {
    screenshotFileName.textContent = file
      ? `${file.name} selected for evidence review.`
      : 'PNG, JPG, or WebP evidence for future AI review.';
  }
});

addTradeForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(addTradeForm);
  const tradeName = String(formData.get('tradeName') || '').trim();
  const marketType = String(formData.get('marketType') || 'Stock');
  const strategyUsed = String(formData.get('strategyUsed') || 'Other');
  const tradeDirection = String(formData.get('tradeDirection') || 'Buy');
  const tradeDate = String(formData.get('tradeDate') || new Date().toISOString().slice(0, 10));
  const entryPrice = Number(formData.get('entryPrice') || 0);
  const exitPrice = Number(formData.get('exitPrice') || 0);
  const capitalUsed = Number(formData.get('capitalUsed') || 0);
  const notes = String(formData.get('tradeNotes') || '').trim();
  const pnl = exitPrice ? Math.round((exitPrice - entryPrice) * (tradeDirection === 'Buy' ? 1 : -1)) : 0;

  const aiReadyTrade = {
    aiSchema: addTradeForm.dataset.aiSchema,
    tradeName,
    marketType,
    strategyUsed,
    tradeDirection,
    tradeDate,
    capitalUsed,
    entryPrice,
    exitPrice,
    stopLoss: Number(formData.get('stopLoss') || 0),
    target: Number(formData.get('target') || 0),
    emotionBeforeTrade: String(formData.get('emotionBeforeTrade') || ''),
    tradeNotes: notes,
    screenshotFileName: tradeScreenshot?.files?.[0]?.name || ''
  };

  trades.unshift({
    date: tradeDate,
    market: marketType,
    symbol: tradeName || marketType,
    strategy: strategyUsed,
    direction: tradeDirection,
    result: exitPrice ? (pnl >= 0 ? 'Win' : 'Loss') : 'Open',
    pnl,
    notes: notes || `Emotion: ${aiReadyTrade.emotionBeforeTrade}. Capital: ${capitalUsed.toLocaleString()}.`
  });

  addTradeForm.dataset.lastAiPayload = JSON.stringify(aiReadyTrade);
  if (addTradeStatus) addTradeStatus.textContent = 'Trade saved locally with AI-ready metadata.';
  addTradeForm.reset();
  if (screenshotFileName) screenshotFileName.textContent = 'PNG, JPG, or WebP evidence for future AI review.';
  renderTrades();
});

renderTrades();
