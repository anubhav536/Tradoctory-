/* ===================================================
   TRADOCTORY — JOURNAL PAGE  (journal.js)
   =================================================== */
'use strict';

import { guardRoute, signOutAndRedirect } from './route-guard.js';
import { LocalTradeRepository } from './trades/local-trade-repository.js';
import { TradeService } from './trades/trade-service.js';
import { calculateTradeStatistics } from './trades/trade-statistics.js';

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
const directionFilter = document.getElementById('directionFilter');
const tradeSearchInput = document.getElementById('tradeSearchInput');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const paginationStatus = document.getElementById('paginationStatus');
const pageRange = document.getElementById('pageRange');
const resetFilters = document.getElementById('resetFilters');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const addTradeBtn = document.getElementById('addTradeBtn');
const topLogTradeBtn = document.getElementById('topLogTradeBtn');
const addTradeFormSection = document.getElementById('addTradeFormSection');
const addTradeForm = document.getElementById('addTradeForm');
const tradeScreenshot = document.getElementById('tradeScreenshot');
const screenshotFileName = document.getElementById('screenshotFileName');
const addTradeStatus = document.getElementById('addTradeStatus');
const sortButtons = document.querySelectorAll('.sort-button');
const tradeDetailModal = document.getElementById('tradeDetailModal');
const tradeDetailContent = document.getElementById('tradeDetailContent');
const tradeDetailDialog = tradeDetailModal?.querySelector('.trade-detail-dialog');
const tradeDetailClose = document.getElementById('tradeDetailClose');
let lastFocusedElement = null;

let currentPage = 1;
let sortState = { key: 'tradeDate', direction: 'desc' };

function formatDate(value) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function formatMoney(value) {
  const numericValue = Number(value) || 0;
  return `$${Math.abs(numericValue).toLocaleString()}`;
}

function formatCurrency(value) {
  const numericValue = Number(value) || 0;
  const sign = numericValue >= 0 ? '+' : '−';
  return `${sign}${formatMoney(numericValue)}`;
}

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

function formatFullDate(value) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function getScreenshotMarkup(trade) {
  if (typeof trade.screenshot === 'object' && trade.screenshot?.dataUrl) {
    return `<img src="${trade.screenshot.dataUrl}" alt="${escapeHtml(trade.screenshot.name || `${trade.tradeName} screenshot`)}" />`;
  }

  const screenshotLabel = typeof trade.screenshot === 'string' ? trade.screenshot : '';
  return `<div class="trade-detail-screenshot-empty">
    <svg width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <circle cx="8.5" cy="10.5" r="1.5"/>
      <path d="M21 15l-4.5-4.5L6 21"/>
    </svg>
    <span>${escapeHtml(screenshotLabel || 'No screenshot uploaded')}</span>
  </div>`;
}

function renderDetailItem(label, value, className = '') {
  return `<div class="trade-detail-item ${className}"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function openTradeModal(tradeId) {
  const trade = trades.find((item) => item.id === tradeId);
  if (!trade || !tradeDetailModal || !tradeDetailContent) return;

  const pnlClass = trade.profitLoss >= 0 ? 'profit' : 'loss';
  lastFocusedElement = document.activeElement;
  tradeDetailContent.innerHTML = `
    <header class="trade-detail-header">
      <div>
        <p class="trade-detail-eyebrow">Trade Information</p>
        <h2 id="tradeDetailTitle">${escapeHtml(trade.tradeName)}</h2>
        <div class="trade-detail-chips">
          <span>${escapeHtml(trade.marketType)}</span>
          <span>${escapeHtml(trade.strategy)}</span>
          <span>${escapeHtml(trade.direction)}</span>
        </div>
      </div>
      <div class="trade-detail-result ${pnlClass}">${escapeHtml(trade.tradeResult)}</div>
    </header>

    <div class="trade-detail-grid">
      <section class="trade-detail-panel trade-detail-info-panel" aria-label="Trade Information">
        <h3>Trade Information</h3>
        <div class="trade-detail-items">
          ${renderDetailItem('Date', formatFullDate(trade.tradeDate))}
          ${renderDetailItem('Capital Used', formatMoney(trade.capital))}
          ${renderDetailItem('Entry Price', trade.entryPrice)}
          ${renderDetailItem('Exit Price', trade.exitPrice || 'Open')}
          ${renderDetailItem('Stop Loss', trade.stopLoss)}
          ${renderDetailItem('Target', trade.target)}
        </div>
      </section>

      <section class="trade-detail-panel" aria-label="Screenshot">
        <h3>Screenshot</h3>
        <div class="trade-detail-screenshot">${getScreenshotMarkup(trade)}</div>
      </section>

      <section class="trade-detail-panel" aria-label="Notes">
        <h3>Notes</h3>
        <p class="trade-detail-notes">${escapeHtml(trade.notes || 'No notes added for this trade.')}</p>
      </section>

      <section class="trade-detail-panel trade-detail-metrics" aria-label="Emotion risk reward and profit loss">
        <h3>Psychology & Outcome</h3>
        <div class="trade-detail-items">
          ${renderDetailItem('Emotion', trade.emotion || 'Not logged')}
          ${renderDetailItem('Risk Reward', `${trade.riskRewardRatio}:1`)}
          ${renderDetailItem('Profit/Loss', formatCurrency(trade.profitLoss), pnlClass)}
        </div>
      </section>
    </div>
  `;

  tradeDetailModal.classList.add('open');
  tradeDetailModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  tradeDetailDialog?.focus({ preventScroll: true });
}

function closeTradeModal() {
  if (!tradeDetailModal) return;
  tradeDetailModal.classList.remove('open');
  tradeDetailModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  lastFocusedElement?.focus?.({ preventScroll: true });
}

function renderSummary() {
  const statistics = calculateTradeStatistics(trades);

  document.getElementById('totalTrades')?.replaceChildren(String(statistics.totalTrades));
  document.getElementById('totalPnl')?.replaceChildren(formatCurrency(statistics.totalProfit));
  document.getElementById('winRate')?.replaceChildren(`${statistics.winRate}%`);
  document.getElementById('currentStreak')?.replaceChildren(getCurrentStreak(trades));
  document.querySelector('#winRate + .stat-delta')?.replaceChildren(`${statistics.winningTrades} wins / ${statistics.losingTrades} losses`);
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
  const sortedTrades = sortTrades(filteredTrades);
  const pageSize = Number(pageSizeSelect?.value) || 10;
  const totalPages = Math.max(1, Math.ceil(sortedTrades.length / pageSize));
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedTrades = sortedTrades.slice(pageStart, pageStart + pageSize);

  tableBody.innerHTML = paginatedTrades.map((trade) => {
    const tagClass = trade.tradeResult.toLowerCase();
    const pnlClass = trade.profitLoss >= 0 ? 'profit' : 'loss';
    return `
      <tr class="trade-history-row ${pnlClass}" data-trade-id="${escapeHtml(trade.id)}" tabindex="0" aria-label="Open details for ${escapeHtml(trade.tradeName)}">
        <td data-label="Date">${formatDate(trade.tradeDate)}</td>
        <td data-label="Trade Name" class="trade-name-cell">
          <strong>${escapeHtml(trade.tradeName)}</strong>
          <span>${escapeHtml(trade.marketType)}</span>
        </td>
        <td data-label="Strategy">${escapeHtml(trade.strategy)}</td>
        <td data-label="Direction"><span class="direction-pill">${escapeHtml(trade.direction)}</span></td>
        <td data-label="Profit/Loss" class="pnl-cell ${pnlClass}">${formatCurrency(trade.profitLoss)}</td>
        <td data-label="Result"><span class="tag ${tagClass}">${trade.tradeResult.toUpperCase()}</span></td>
      </tr>
    `;
  }).join('');

  const rangeStart = sortedTrades.length ? pageStart + 1 : 0;
  const rangeEnd = Math.min(pageStart + paginatedTrades.length, sortedTrades.length);
  if (entryCount) entryCount.textContent = `${filteredTrades.length} ${filteredTrades.length === 1 ? 'entry' : 'entries'}`;
  if (pageRange) pageRange.textContent = `${rangeStart}-${rangeEnd} shown`;
  if (paginationStatus) paginationStatus.textContent = `Page ${currentPage} of ${totalPages}`;
  if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
  if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
  if (emptyState) emptyState.hidden = filteredTrades.length > 0;
  renderSortIndicators();
  renderSummary();
}

[fromDateFilter, toDateFilter, strategyFilter, resultFilter, directionFilter, pageSizeSelect].forEach((filter) => {
  filter?.addEventListener('change', () => {
    currentPage = 1;
    renderTrades();
  });
});

tradeSearchInput?.addEventListener('input', () => {
  currentPage = 1;
  renderTrades();
});

sortButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const nextKey = button.dataset.sort;
    sortState = {
      key: nextKey,
      direction: sortState.key === nextKey && sortState.direction === 'asc' ? 'desc' : 'asc'
    };
    currentPage = 1;
    renderTrades();
  });
});

prevPageBtn?.addEventListener('click', () => {
  currentPage = Math.max(1, currentPage - 1);
  renderTrades();
});

nextPageBtn?.addEventListener('click', () => {
  currentPage += 1;
  renderTrades();
});

tableBody?.addEventListener('click', (event) => {
  const row = event.target.closest('.trade-history-row');
  if (row?.dataset.tradeId) openTradeModal(row.dataset.tradeId);
});

tableBody?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const row = event.target.closest('.trade-history-row');
  if (!row?.dataset.tradeId) return;
  event.preventDefault();
  openTradeModal(row.dataset.tradeId);
});

tradeDetailModal?.addEventListener('click', (event) => {
  if (event.target.closest('[data-modal-close]')) closeTradeModal();
});

tradeDetailClose?.addEventListener('click', closeTradeModal);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && tradeDetailModal?.classList.contains('open')) closeTradeModal();
});

resetFilters?.addEventListener('click', () => {
  if (fromDateFilter) fromDateFilter.value = '';
  if (toDateFilter) toDateFilter.value = '';
  if (strategyFilter) strategyFilter.value = 'all';
  if (resultFilter) resultFilter.value = 'all';
  if (directionFilter) directionFilter.value = 'all';
  if (tradeSearchInput) tradeSearchInput.value = '';
  if (pageSizeSelect) pageSizeSelect.value = '10';
  currentPage = 1;
  sortState = { key: 'tradeDate', direction: 'desc' };
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
    screenshot: await getScreenshotPayload(tradeScreenshot?.files?.[0])
  });

  trades = [trade, ...trades];
  addTradeForm.dataset.lastAiPayload = JSON.stringify(trade);
  if (addTradeStatus) addTradeStatus.textContent = `Trade saved locally. P/L: ${formatCurrency(trade.profitLoss)} · R:R ${trade.riskRewardRatio}:1 · ${trade.tradeResult}.`;
  addTradeForm.reset();
  if (screenshotFileName) screenshotFileName.textContent = 'PNG, JPG, or WebP evidence for future AI review.';
  renderTrades();
});

function getFilteredTrades() {
  const query = (tradeSearchInput?.value || '').trim().toLowerCase();

  return trades.filter((trade) => {
    const searchableText = [
      trade.tradeDate,
      trade.tradeName,
      trade.strategy,
      trade.direction,
      formatCurrency(trade.profitLoss),
      trade.tradeResult,
      trade.marketType
    ].join(' ').toLowerCase();
    const matchesSearch = !query || searchableText.includes(query);
    const matchesFromDate = !fromDateFilter?.value || trade.tradeDate >= fromDateFilter.value;
    const matchesToDate = !toDateFilter?.value || trade.tradeDate <= toDateFilter.value;
    const matchesStrategy = strategyFilter?.value === 'all' || trade.strategy === strategyFilter?.value;
    const matchesResult = resultFilter?.value === 'all' || trade.tradeResult === resultFilter?.value;
    const matchesDirection = directionFilter?.value === 'all' || trade.direction === directionFilter?.value;
    return matchesSearch && matchesFromDate && matchesToDate && matchesStrategy && matchesResult && matchesDirection;
  });
}

function sortTrades(items) {
  return [...items].sort((firstTrade, secondTrade) => {
    const firstValue = firstTrade[sortState.key];
    const secondValue = secondTrade[sortState.key];
    const directionModifier = sortState.direction === 'asc' ? 1 : -1;

    if (sortState.key === 'profitLoss') {
      return ((Number(firstValue) || 0) - (Number(secondValue) || 0)) * directionModifier;
    }

    return String(firstValue || '').localeCompare(String(secondValue || ''), undefined, {
      numeric: true,
      sensitivity: 'base'
    }) * directionModifier;
  });
}

function renderSortIndicators() {
  sortButtons.forEach((button) => {
    const isActive = button.dataset.sort === sortState.key;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-sort', isActive ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none');
    const indicator = button.querySelector('span');
    if (indicator) indicator.textContent = isActive ? (sortState.direction === 'asc' ? '↑' : '↓') : '↕';
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
    return `<tr><td>${formatDate(trade.tradeDate)}</td><td>${escapeHtml(trade.marketType)}</td><td>${escapeHtml(trade.tradeName)}</td><td>${escapeHtml(trade.strategy)}</td><td>${escapeHtml(trade.direction)}</td><td>${trade.tradeResult}</td><td>${formatCurrency(trade.profitLoss)}</td><td>${trade.riskRewardRatio}:1</td><td>${escapeHtml(trade.notes)}</td><td>${screenshot}</td></tr>`;
  }).join('');

  const reportWindow = window.open('', '_blank');
  if (!reportWindow) {
    if (addTradeStatus) addTradeStatus.textContent = 'Please allow pop-ups to export the trade PDF.';
    return;
  }
  reportWindow.document.write(`<!doctype html><html><head><title>Trade Report ${rangeLabel}</title><style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#111}h1{margin-bottom:4px}.meta{color:#555;margin-bottom:20px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ddd;padding:8px;vertical-align:top}th{background:#f4f6f8;text-align:left}img{max-width:180px;max-height:120px;border:1px solid #ddd}@media print{@page{size:landscape;margin:12mm}}</style></head><body><h1>My Logged Trade Details</h1><div class="meta">Range: ${escapeHtml(rangeLabel)} · Total: ${reportTrades.length}</div><table><thead><tr><th>Date</th><th>Market</th><th>Symbol</th><th>Strategy</th><th>Direction</th><th>Result</th><th>P&amp;L</th><th>R:R</th><th>Notes</th><th>Screenshot</th></tr></thead><tbody>${rows || '<tr><td colspan="10">No trades in selected range.</td></tr>'}</tbody></table><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`);
  reportWindow.document.close();
}

exportPdfBtn?.addEventListener('click', renderPdfReport);

async function initializeJournal() {
  trades = await tradeService.listTrades();
  renderTrades();
}

initializeJournal();
