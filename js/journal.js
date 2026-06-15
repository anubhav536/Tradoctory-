/* ===================================================
   TRADOCTORY — JOURNAL PAGE  (journal.js)
   =================================================== */
'use strict';

import { guardRoute, signOutAndRedirect } from './route-guard.js';
import { LocalTradeRepository } from './trades/local-trade-repository.js';
import { TradeService } from './trades/trade-service.js';

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
const seedTrades = [
  { tradeDate: '2026-06-15', marketType: 'Nifty', tradeName: 'Nifty ORB', strategy: 'ORB', direction: 'Buy', tradeResult: 'Win', capital: 25000, entryPrice: 100, exitPrice: 104.96, stopLoss: 98, target: 106, notes: 'Opening range breakout held above VWAP.' },
  { tradeDate: '2026-06-14', marketType: 'Crypto', tradeName: 'BTC/USD', strategy: 'Breakout', direction: 'Buy', capital: 10000, entryPrice: 100, exitPrice: 103.8, stopLoss: 98, target: 105, notes: 'Clean breakout through prior resistance.' },
  { tradeDate: '2026-06-13', marketType: 'BankNifty', tradeName: 'BankNifty Pullback', strategy: 'Pullback', direction: 'Sell', capital: 9500, entryPrice: 100, exitPrice: 101, stopLoss: 102, target: 96, notes: 'Pullback failed after a fast reversal candle.' },
  { tradeDate: '2026-06-12', marketType: 'Stock', tradeName: 'AAPL', strategy: 'Support Resistance', direction: 'Buy', capital: 15000, entryPrice: 100, exitPrice: 101.4, stopLoss: 98, target: 105, notes: 'Pre-earnings swing remains above trend support.' },
  { tradeDate: '2026-06-11', marketType: 'Forex', tradeName: 'EUR/USD', strategy: 'VWAP', direction: 'Sell', capital: 20000, entryPrice: 100, exitPrice: 96.9, stopLoss: 102, target: 95, notes: 'Continuation aligned with dollar strength.' },
  { tradeDate: '2026-06-10', marketType: 'Stock', tradeName: 'TSLA', strategy: 'Other', direction: 'Buy', capital: 16000, entryPrice: 100, exitPrice: 98, stopLoss: 98, target: 106, notes: 'Entered early and failed to respect stop plan.' }
];

const tradeRepository = new LocalTradeRepository({ userId: user.id || user.email });
const tradeService = new TradeService({ repository: tradeRepository, userId: user.id || user.email });
let trades = [];

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

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

function renderSummary() {
  const closedTrades = trades.filter((trade) => trade.tradeResult !== 'Open');
  const wins = trades.filter((trade) => trade.tradeResult === 'Win').length;
  const losses = trades.filter((trade) => trade.tradeResult === 'Loss').length;
  const totalPnlValue = trades.reduce((total, trade) => total + trade.profitLoss, 0);
  const winRateValue = closedTrades.length ? Math.round((wins / closedTrades.length) * 100) : 0;

  document.getElementById('totalTrades')?.replaceChildren(String(trades.length));
  document.getElementById('totalPnl')?.replaceChildren(formatCurrency(totalPnlValue));
  document.getElementById('winRate')?.replaceChildren(`${winRateValue}%`);
  document.getElementById('currentStreak')?.replaceChildren(getCurrentStreak(trades));
  document.querySelector('#winRate + .stat-delta')?.replaceChildren(`${wins} wins / ${losses} losses`);
}

function getCurrentStreak(items) {
  const firstClosedTrade = items.find((trade) => trade.tradeResult === 'Win' || trade.tradeResult === 'Loss');
  if (!firstClosedTrade) return '0';

  let streakCount = 0;
  for (const trade of items) {
    if (trade.tradeResult !== firstClosedTrade.tradeResult) break;
    streakCount += 1;
  }

  return `${streakCount}${firstClosedTrade.tradeResult.charAt(0)}`;
}

function renderTrades() {
  if (!tableBody) return;

  const filteredTrades = trades.filter((trade) => {
    const matchesDate = !dateFilter?.value || trade.tradeDate === dateFilter.value;
    const matchesStrategy = strategyFilter?.value === 'all' || trade.strategy === strategyFilter?.value;
    const matchesResult = resultFilter?.value === 'all' || trade.tradeResult === resultFilter?.value;
    const matchesMarket = marketFilter?.value === 'all' || trade.marketType === marketFilter?.value;
    return matchesDate && matchesStrategy && matchesResult && matchesMarket;
  });

  tableBody.innerHTML = filteredTrades.map((trade) => {
    const tagClass = trade.tradeResult.toLowerCase();
    const pnlClass = trade.profitLoss >= 0 ? 'var(--accent)' : 'var(--red)';
    return `
      <tr>
        <td>${formatDate(trade.tradeDate)}</td>
        <td>${escapeHtml(trade.marketType)}</td>
        <td style="color:var(--text-primary);font-weight:600;">${escapeHtml(trade.tradeName)}</td>
        <td>${escapeHtml(trade.strategy)}</td>
        <td>${escapeHtml(trade.direction)}</td>
        <td><span class="tag ${tagClass}">${trade.tradeResult.toUpperCase()}</span></td>
        <td style="color:${pnlClass};font-weight:700;">${formatCurrency(trade.profitLoss)}</td>
        <td style="color:var(--text-muted);font-size:12px;">${escapeHtml(trade.notes)}</td>
      </tr>
    `;
  }).join('');

  if (entryCount) entryCount.textContent = `${filteredTrades.length} ${filteredTrades.length === 1 ? 'entry' : 'entries'}`;
  if (emptyState) emptyState.hidden = filteredTrades.length > 0;
  renderSummary();
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

addTradeForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(addTradeForm);
  const trade = await tradeService.addTrade({
    tradeName: formData.get('tradeName'),
    marketType: formData.get('marketType'),
    strategy: formData.get('strategyUsed'),
    direction: formData.get('tradeDirection'),
    tradeDate: formData.get('tradeDate'),
    capital: formData.get('capitalUsed'),
    entryPrice: formData.get('entryPrice'),
    exitPrice: formData.get('exitPrice'),
    stopLoss: formData.get('stopLoss'),
    target: formData.get('target'),
    emotion: formData.get('emotionBeforeTrade'),
    notes: formData.get('tradeNotes'),
    screenshot: tradeScreenshot?.files?.[0]?.name || ''
  });

  trades = [trade, ...trades];
  addTradeForm.dataset.lastAiPayload = JSON.stringify(trade);
  if (addTradeStatus) addTradeStatus.textContent = `Trade saved locally. P/L: ${formatCurrency(trade.profitLoss)} · R:R ${trade.riskRewardRatio}:1 · ${trade.tradeResult}.`;
  addTradeForm.reset();
  if (screenshotFileName) screenshotFileName.textContent = 'PNG, JPG, or WebP evidence for future AI review.';
  renderTrades();
});

async function initializeJournal() {
  trades = await tradeService.seedTrades(seedTrades);
  renderTrades();
}

initializeJournal();
