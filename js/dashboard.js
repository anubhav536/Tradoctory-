/* ===================================================
   TRADOCTORY — DASHBOARD PAGE  (dashboard.js)
   =================================================== */
'use strict';

import { guardRoute, signOutAndRedirect } from './route-guard.js';
import { LocalTradeRepository } from './trades/local-trade-repository.js';
import { TradeService } from './trades/trade-service.js';
import { calculateTradeStatistics } from './trades/trade-statistics.js';
import { analyzeTraderDna } from './trades/trader-dna-analysis.js';
import { analyzeConsistency } from './trades/consistency-analysis.js';

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

/* ── 5. Premium fintech dashboard ────────────────── */
const tradeRepository = new LocalTradeRepository({ userId: user.id || user.email });
const tradeService = new TradeService({ repository: tradeRepository, userId: user.id || user.email });

const equityCurveChart = document.getElementById('equityCurveChart');
const winLossPieChart = document.getElementById('winLossPieChart');
const winLossLegend = document.getElementById('winLossLegend');
const strategyPerformanceChart = document.getElementById('strategyPerformanceChart');
const weeklyPerformanceChart = document.getElementById('weeklyPerformanceChart');

function formatCurrency(value) {
  const numericValue = Number(value) || 0;
  const sign = numericValue >= 0 ? '+' : '−';
  return `${sign}$${Math.abs(numericValue).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function renderMetric(id, value) {
  document.getElementById(id)?.replaceChildren(value);
}

function setTone(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.classList.remove('green', 'red', 'blue');
  if (value > 0) element.classList.add('green');
  if (value < 0) element.classList.add('red');
}

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

function getClosedTrades(trades) {
  return trades.filter((trade) => ['win', 'loss'].includes(String(trade.tradeResult).toLowerCase()));
}

function parseTradeDate(trade) {
  const rawDate = trade.tradeDate || trade.createdAt;
  if (!rawDate) return new Date(0);
  return new Date(String(rawDate).includes('T') ? rawDate : `${rawDate}T00:00:00`);
}

function getBestStrategy(trades) {
  const strategyMap = new Map();
  trades.forEach((trade) => {
    const strategy = trade.strategy || 'Unlabeled';
    const existing = strategyMap.get(strategy) || { pnl: 0, count: 0 };
    strategyMap.set(strategy, { pnl: existing.pnl + (Number(trade.profitLoss) || 0), count: existing.count + 1 });
  });
  return [...strategyMap.entries()].sort((a, b) => b[1].pnl - a[1].pnl)[0];
}

function getCurrentStreak(closedTrades) {
  const sortedTrades = [...closedTrades].sort((a, b) => parseTradeDate(b) - parseTradeDate(a));
  const latestResult = sortedTrades[0]?.tradeResult?.toLowerCase();
  if (!latestResult) return { label: '—', count: 0, result: '' };
  const count = sortedTrades.findIndex((trade) => trade.tradeResult.toLowerCase() !== latestResult);
  const streakCount = count === -1 ? sortedTrades.length : count;
  return { label: `${streakCount} ${latestResult}${streakCount === 1 ? '' : 's'}`, count: streakCount, result: latestResult };
}

function renderStatistics(trades) {
  const statistics = calculateTradeStatistics(trades);
  const closedTrades = getClosedTrades(trades);
  const bestStrategy = getBestStrategy(trades);
  const streak = getCurrentStreak(closedTrades);
  const consistency = analyzeConsistency(trades);

  renderMetric('totalTrades', String(statistics.totalTrades));
  renderMetric('totalPnl', formatCurrency(statistics.totalProfit));
  renderMetric('winRate', `${statistics.winRate}%`);
  renderMetric('currentStreak', streak.label);
  renderMetric('bestStrategy', bestStrategy ? bestStrategy[0] : '—');
  renderMetric('consistencyScore', String(Math.round(consistency.score)));
  renderMetric('consistencyScoreDetail', String(Math.round(consistency.score)));
  renderMetric('consistencyTrend', consistency.trend.label);
  renderConsistencyDetails(consistency);
  renderMetric('totalPnlDelta', statistics.totalProfit >= 0 ? 'Portfolio is net profitable' : 'Portfolio is in drawdown');
  renderMetric('currentStreakDelta', streak.result ? `Latest closed trades are ${streak.result}s` : 'Awaiting closed trades');
  renderMetric('bestStrategyDelta', bestStrategy ? `${formatCurrency(bestStrategy[1].pnl)} across ${bestStrategy[1].count} trade${bestStrategy[1].count === 1 ? '' : 's'}` : 'Log strategies to rank setups');

  setTone('totalPnl', statistics.totalProfit);
  setTone('currentStreak', streak.result === 'win' ? streak.count : -streak.count);
  setTone('consistencyScore', consistency.score - 50);
}

function renderEquityCurve(trades) {
  if (!equityCurveChart) return;
  const sortedTrades = [...trades].sort((a, b) => parseTradeDate(a) - parseTradeDate(b));
  let runningTotal = 0;
  const points = sortedTrades.map((trade) => {
    runningTotal += Number(trade.profitLoss) || 0;
    return runningTotal;
  });
  if (!points.length) {
    equityCurveChart.innerHTML = '<div class="chart-empty">Log trades in your journal to build an equity curve.</div>';
    return;
  }
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 1);
  const range = Math.max(max - min, 1);
  equityCurveChart.innerHTML = points.map((value, index) => {
    const height = ((value - min) / range) * 100;
    const left = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    return `<span class="equity-point ${value >= 0 ? 'green' : 'red'}" style="left:${left}%;bottom:${height}%" title="${formatCurrency(value)}"></span>`;
  }).join('');
}

function renderWinLossPie(trades) {
  const statistics = calculateTradeStatistics(trades);
  const closedTotal = statistics.winningTrades + statistics.losingTrades;
  const winPercent = closedTotal ? Math.round((statistics.winningTrades / closedTotal) * 100) : 0;
  if (winLossPieChart) {
    winLossPieChart.style.setProperty('--win-percent', `${winPercent}%`);
    winLossPieChart.innerHTML = `<span>${winPercent}%</span><small>Win rate</small>`;
  }
  if (winLossLegend) {
    winLossLegend.innerHTML = `
      <div><span class="legend-dot green"></span><strong>${statistics.winningTrades}</strong> Wins</div>
      <div><span class="legend-dot red"></span><strong>${statistics.losingTrades}</strong> Losses</div>
    `;
  }
}

function renderStrategyPerformance(trades) {
  if (!strategyPerformanceChart) return;
  const strategies = [...trades.reduce((map, trade) => {
    const strategy = trade.strategy || 'Unlabeled';
    map.set(strategy, (map.get(strategy) || 0) + (Number(trade.profitLoss) || 0));
    return map;
  }, new Map()).entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5);
  const max = Math.max(...strategies.map(([, pnl]) => Math.abs(pnl)), 1);
  strategyPerformanceChart.innerHTML = strategies.map(([strategy, pnl]) => `
    <div class="horizontal-row">
      <div class="horizontal-label"><span>${escapeHtml(strategy)}</span><strong class="${pnl >= 0 ? 'green' : 'red'}">${formatCurrency(pnl)}</strong></div>
      <div class="horizontal-track"><span class="${pnl >= 0 ? 'green' : 'red'}" style="width:${Math.max((Math.abs(pnl) / max) * 100, 4)}%"></span></div>
    </div>
  `).join('') || '<div class="chart-empty">Add strategies to compare performance.</div>';
}

function getWeekLabel(date) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}


function formatFactorLabel(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}

function renderConsistencyDetails(consistency) {
  const trendEl = document.getElementById('consistencyTrend');
  if (trendEl) {
    trendEl.classList.remove('green', 'red', 'blue');
    trendEl.classList.add(consistency.trend.direction === 'up' ? 'green' : consistency.trend.direction === 'down' ? 'red' : 'blue');
  }

  const factorsEl = document.getElementById('consistencyFactors');
  if (factorsEl) {
    factorsEl.innerHTML = Object.entries(consistency.factors).map(([key, value]) => `
      <div class="consistency-factor">
        <div><span>${escapeHtml(formatFactorLabel(key))}</span><strong>${Math.round(value)}</strong></div>
        <div class="consistency-factor-track"><span style="width:${Math.max(value, 4)}%"></span></div>
      </div>
    `).join('');
  }

  const suggestionsEl = document.getElementById('consistencySuggestions');
  if (suggestionsEl) {
    suggestionsEl.innerHTML = consistency.suggestions.map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`).join('');
  }
}

function renderTraderDna(trades) {
  const profile = analyzeTraderDna(trades);
  const typeEl = document.getElementById('traderDnaType');
  const subtitleEl = document.getElementById('traderDnaSubtitle');
  const confidenceEl = document.getElementById('traderDnaConfidence');
  const strengthsEl = document.getElementById('traderDnaStrengths');
  const weaknessesEl = document.getElementById('traderDnaWeaknesses');

  typeEl?.replaceChildren(profile.traderType);
  subtitleEl?.replaceChildren(profile.metrics.totalTrades
    ? `${profile.engine} classification across ${profile.metrics.totalTrades} trade${profile.metrics.totalTrades === 1 ? '' : 's'} · prepared for future AI upgrades`
    : 'Log trades in your journal to generate a DNA profile.');
  confidenceEl?.replaceChildren(`${profile.confidenceScore}%`);

  if (strengthsEl) {
    strengthsEl.innerHTML = profile.strengths.map((strength) => `<li>${escapeHtml(strength)}</li>`).join('');
  }

  if (weaknessesEl) {
    weaknessesEl.innerHTML = profile.weaknesses.map((weakness) => `<li>${escapeHtml(weakness)}</li>`).join('');
  }
}

function renderWeeklyPerformance(trades) {
  if (!weeklyPerformanceChart) return;
  const buckets = new Map();
  const now = new Date();
  for (let i = 7; i >= 0; i -= 1) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (now.getDay() + (i * 7)));
    weekStart.setHours(0, 0, 0, 0);
    buckets.set(weekStart.toISOString().slice(0, 10), { label: getWeekLabel(weekStart), pnl: 0 });
  }
  trades.forEach((trade) => {
    const tradeDate = parseTradeDate(trade);
    if (Number.isNaN(tradeDate.getTime())) return;
    const weekStart = new Date(tradeDate);
    weekStart.setDate(tradeDate.getDate() - tradeDate.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const key = weekStart.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.get(key).pnl += Number(trade.profitLoss) || 0;
  });
  const weeks = [...buckets.values()];
  const max = Math.max(...weeks.map((week) => Math.abs(week.pnl)), 1);
  weeklyPerformanceChart.innerHTML = weeks.map((week) => `
    <div class="weekly-bar-wrap">
      <div class="weekly-bar ${week.pnl >= 0 ? 'green' : 'red'}" style="height:${Math.max((Math.abs(week.pnl) / max) * 100, 6)}%" title="${formatCurrency(week.pnl)}"></div>
      <span>${escapeHtml(week.label)}</span>
    </div>
  `).join('');
}

async function refreshDashboard() {
  const trades = await tradeService.listTrades();
  renderStatistics(trades);
  renderEquityCurve(trades);
  renderWinLossPie(trades);
  renderStrategyPerformance(trades);
  renderWeeklyPerformance(trades);
  renderTraderDna(trades);
}

window.addEventListener('storage', (event) => {
  if (event.key === tradeRepository.storageKey) refreshDashboard();
});

refreshDashboard();
