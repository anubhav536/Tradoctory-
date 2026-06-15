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
const tradeRepository = new LocalTradeRepository({ userId: user.id || user.email });
const tradeService = new TradeService({ repository: tradeRepository, userId: user.id || user.email });
let trades = [];

const tableBody = document.getElementById('tradeTableBody');
const entryCount = document.getElementById('entryCount');
const emptyState = document.getElementById('emptyState');
const fromDateFilter = document.getElementById('fromDateFilter');
const toDateFilter = document.getElementById('toDateFilter');
const strategyFilter = document.getElementById('strategyFilter');
const resultFilter = document.getElementById('resultFilter');
const marketFilter = document.getElementById('marketFilter');
const resetFilters = document.getElementById('resetFilters');
const exportPdfBtn = document.getElementById('exportPdfBtn');
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

  const filteredTrades = getFilteredTrades();

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

[fromDateFilter, toDateFilter, strategyFilter, resultFilter, marketFilter].forEach((filter) => {
  filter?.addEventListener('change', renderTrades);
});

resetFilters?.addEventListener('click', () => {
  if (fromDateFilter) fromDateFilter.value = '';
  if (toDateFilter) toDateFilter.value = '';
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
    emotion: formData.get('emotionBeforeTrade'),
    notes: formData.get('tradeNotes'),
    screenshot: await getScreenshotPayload(tradeScreenshot?.files?.[0])
  });

  trades = [trade, ...trades];
  addTradeForm.dataset.lastAiPayload = JSON.stringify(trade);
  if (addTradeStatus) addTradeStatus.textContent = `Trade saved locally. P/L: ${formatCurrency(trade.profitLoss)} · ${trade.tradeResult}.`;
  addTradeForm.reset();
  if (screenshotFileName) screenshotFileName.textContent = 'PNG, JPG, or WebP evidence for future AI review.';
  renderTrades();
});

function getFilteredTrades() {
  return trades.filter((trade) => {
    const matchesFromDate = !fromDateFilter?.value || trade.tradeDate >= fromDateFilter.value;
    const matchesToDate = !toDateFilter?.value || trade.tradeDate <= toDateFilter.value;
    const matchesStrategy = strategyFilter?.value === 'all' || trade.strategy === strategyFilter?.value;
    const matchesResult = resultFilter?.value === 'all' || trade.tradeResult === resultFilter?.value;
    const matchesMarket = marketFilter?.value === 'all' || trade.marketType === marketFilter?.value;
    return matchesFromDate && matchesToDate && matchesStrategy && matchesResult && matchesMarket;
  });
}

function getScreenshotPayload(file) {
  if (!file) return Promise.resolve('');
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve({ name: file.name, dataUrl: reader.result }));
    reader.addEventListener('error', () => resolve(file.name));
    reader.readAsDataURL(file);
  });
}

function renderPdfReport() {
  const reportTrades = getFilteredTrades();
  const rangeLabel = `${fromDateFilter?.value || 'Start'} to ${toDateFilter?.value || 'Today'}`;
  const rows = reportTrades.map((trade) => {
    const screenshot = typeof trade.screenshot === 'object' && trade.screenshot?.dataUrl
      ? `<img src="${trade.screenshot.dataUrl}" alt="${escapeHtml(trade.screenshot.name || 'Trade screenshot')}" />`
      : escapeHtml(typeof trade.screenshot === 'string' ? trade.screenshot : '');
    return `<tr><td>${formatDate(trade.tradeDate)}</td><td>${escapeHtml(trade.marketType)}</td><td>${escapeHtml(trade.tradeName)}</td><td>${escapeHtml(trade.strategy)}</td><td>${escapeHtml(trade.direction)}</td><td>${trade.tradeResult}</td><td>${formatCurrency(trade.profitLoss)}</td><td>${escapeHtml(trade.notes)}</td><td>${screenshot}</td></tr>`;
  }).join('');

  const reportWindow = window.open('', '_blank');
  if (!reportWindow) {
    if (addTradeStatus) addTradeStatus.textContent = 'Please allow pop-ups to export the trade PDF.';
    return;
  }
  reportWindow.document.write(`<!doctype html><html><head><title>Trade Report ${rangeLabel}</title><style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#111}h1{margin-bottom:4px}.meta{color:#555;margin-bottom:20px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ddd;padding:8px;vertical-align:top}th{background:#f4f6f8;text-align:left}img{max-width:180px;max-height:120px;border:1px solid #ddd}@media print{@page{size:landscape;margin:12mm}}</style></head><body><h1>My Logged Trade Details</h1><div class="meta">Range: ${escapeHtml(rangeLabel)} · Total: ${reportTrades.length}</div><table><thead><tr><th>Date</th><th>Market</th><th>Symbol</th><th>Strategy</th><th>Direction</th><th>Result</th><th>P&amp;L</th><th>Notes</th><th>Screenshot</th></tr></thead><tbody>${rows || '<tr><td colspan="9">No trades in selected range.</td></tr>'}</tbody></table><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`);
  reportWindow.document.close();
}

exportPdfBtn?.addEventListener('click', renderPdfReport);

async function initializeJournal() {
  trades = await tradeService.listTrades();
  renderTrades();
}

initializeJournal();
