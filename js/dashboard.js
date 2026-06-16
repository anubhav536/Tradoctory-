/* ===================================================
   TRADOCTORY — DASHBOARD PAGE  (dashboard.js)
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
const nameEl    = document.getElementById('userDisplayName');
const planEl    = document.getElementById('userDisplayPlan');
const avatarEl  = document.getElementById('userAvatarInitial');
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

/* ── 5. Auto-calculated dashboard statistics ─────── */
const tradeRepository = new LocalTradeRepository({ userId: user.id || user.email });
const tradeService = new TradeService({ repository: tradeRepository, userId: user.id || user.email });

const recentTradesBody = document.getElementById('recentTradesBody');
const emptyRecentTrades = document.getElementById('emptyRecentTrades');
const chartArea = document.getElementById('profitChart');

function formatCurrency(value) {
  const sign = value >= 0 ? '+' : '−';
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function renderMetric(id, value) {
  document.getElementById(id)?.replaceChildren(value);
}

function getCurrencyClass(value) {
  if (value > 0) return 'green';
  if (value < 0) return 'red';
  return '';
}

function setValueClass(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.classList.remove('green', 'red', 'blue');
  const className = getCurrencyClass(value);
  if (className) element.classList.add(className);
}

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

function renderStatistics(trades) {
  const statistics = calculateTradeStatistics(trades);

  renderMetric('totalTrades', String(statistics.totalTrades));
  renderMetric('winningTrades', String(statistics.winningTrades));
  renderMetric('losingTrades', String(statistics.losingTrades));
  renderMetric('winRate', `${statistics.winRate}%`);
  renderMetric('totalProfit', formatCurrency(statistics.totalProfit));
  renderMetric('averageProfit', formatCurrency(statistics.averageProfit));
  renderMetric('averageLoss', formatCurrency(statistics.averageLoss));
  renderMetric('bestTrade', formatCurrency(statistics.bestTrade));
  renderMetric('worstTrade', formatCurrency(statistics.worstTrade));

  ['totalProfit', 'averageProfit', 'averageLoss', 'bestTrade', 'worstTrade'].forEach((id) => {
    const valueKey = id;
    setValueClass(id, statistics[valueKey]);
  });
}

function renderRecentTrades(trades) {
  if (!recentTradesBody) return;

  const rows = trades.slice(0, 5).map((trade) => {
    const tagClass = trade.tradeResult.toLowerCase();
    const pnlClass = getCurrencyClass(trade.profitLoss) || 'blue';
    return `
      <tr>
        <td style="color:var(--text-primary);font-weight:600;">${escapeHtml(trade.tradeName || 'Untitled')}</td>
        <td>${escapeHtml(trade.direction)}</td>
        <td><span class="tag ${tagClass}">${escapeHtml(trade.tradeResult.toUpperCase())}</span></td>
        <td class="${pnlClass}" style="font-weight:600;">${formatCurrency(trade.profitLoss)}</td>
      </tr>
    `;
  }).join('');

  recentTradesBody.innerHTML = rows;
  if (emptyRecentTrades) emptyRecentTrades.hidden = trades.length > 0;
}

function renderProfitChart(trades) {
  if (!chartArea) return;
  const chartTrades = trades.slice(0, 12).reverse();
  const largestMove = Math.max(...chartTrades.map((trade) => Math.abs(trade.profitLoss)), 1);

  chartArea.innerHTML = chartTrades.map((trade) => {
    const height = Math.max((Math.abs(trade.profitLoss) / largestMove) * 100, 8);
    const colorClass = trade.profitLoss >= 0 ? 'green' : 'red';
    return `<div class="chart-bar ${colorClass}" style="height:${height}%" title="${escapeHtml(trade.tradeName)} ${formatCurrency(trade.profitLoss)}"></div>`;
  }).join('') || '<div class="chart-empty">Log trades in your journal to build this chart.</div>';
}

async function refreshDashboard() {
  const trades = await tradeService.listTrades();
  renderStatistics(trades);
  renderRecentTrades(trades);
  renderProfitChart(trades);
}

window.addEventListener('storage', (event) => {
  if (event.key === tradeRepository.storageKey) refreshDashboard();
});

refreshDashboard();
