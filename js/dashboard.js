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
import { isClosedTrade } from './trades/trade.js';
import { MarketDataProvider } from './market/market-data-provider.js';
import { ScannerProvider } from './scanner/scanner-provider.js';
import { AlertProvider } from './scanner/alert-provider.js';
import { AnalyticsProvider } from './scanner/analytics-provider.js';
import { ChartProvider } from './scanner/chart-provider.js';

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
const equityCurveCanvas = document.getElementById('equityCurveCanvas');
const equityCurveInsights = document.getElementById('equityCurveInsights');
let equityCurveInstance = null;
const winLossPieChart = document.getElementById('winLossPieChart');
const winLossLegend = document.getElementById('winLossLegend');
const strategyPerformanceChart = document.getElementById('strategyPerformanceChart');
const weeklyPerformanceChart = document.getElementById('weeklyPerformanceChart');
const scannerRefreshBtn = document.getElementById('scannerRefreshBtn');
const marketDataProvider = new MarketDataProvider();
const scannerProvider = new ScannerProvider({ marketDataProvider });
const alertProvider = new AlertProvider();
const scannerAnalyticsProvider = new AnalyticsProvider();
const scannerChartProvider = new ChartProvider({ chartGlobal: window.Chart });

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

function formatCompactNumber(value) {
  return Number(value || 0).toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 });
}

function formatMarketTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Timestamp unavailable';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
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

function getTradeLabel(trade, index) {
  return trade.tradeDate || trade.createdAt?.slice(0, 10) || `Trade ${index + 1}`;
}

function getPeriodLabel(points, period) {
  if (!period || period.startIndex < 0 || period.endIndex < 0) return 'Not enough closed trades';
  return `${points[period.startIndex]?.label || 'Start'} → ${points[period.endIndex]?.label || 'End'}`;
}

function buildEquityCurveModel(trades) {
  const closedTrades = [...trades]
    .filter(isClosedTrade)
    .sort((a, b) => parseTradeDate(a) - parseTradeDate(b));
  let runningCapital = 0;
  let peak = 0;
  let openDrawdownStart = null;
  const points = closedTrades.map((trade, index) => {
    runningCapital += Number(trade.profitLoss) || 0;
    if (runningCapital >= peak) {
      peak = runningCapital;
      openDrawdownStart = null;
    } else if (openDrawdownStart === null) {
      openDrawdownStart = index;
    }
    return {
      label: getTradeLabel(trade, index),
      growth: Number(runningCapital.toFixed(2)),
      drawdown: Number(Math.min(runningCapital - peak, 0).toFixed(2)),
      recovering: openDrawdownStart !== null
    };
  });

  let bestGrowth = { startIndex: -1, endIndex: -1, value: 0 };
  let minCapital = 0;
  let minIndex = -1;
  points.forEach((point, index) => {
    const growth = point.growth - minCapital;
    if (growth > bestGrowth.value) bestGrowth = { startIndex: minIndex + 1, endIndex: index, value: growth };
    if (point.growth < minCapital) {
      minCapital = point.growth;
      minIndex = index;
    }
  });

  let worstDrawdown = { startIndex: -1, endIndex: -1, value: 0 };
  let peakCapital = 0;
  let peakIndex = -1;
  points.forEach((point, index) => {
    if (point.growth > peakCapital) {
      peakCapital = point.growth;
      peakIndex = index;
    }
    const drawdown = point.growth - peakCapital;
    if (drawdown < worstDrawdown.value) worstDrawdown = { startIndex: peakIndex + 1, endIndex: index, value: drawdown };
  });

  const recoveryPeriods = [];
  let recoveryStart = null;
  points.forEach((point, index) => {
    if (point.drawdown < 0 && recoveryStart === null) recoveryStart = index;
    if (recoveryStart !== null && point.drawdown === 0) {
      recoveryPeriods.push({ startIndex: recoveryStart, endIndex: index });
      recoveryStart = null;
    }
  });
  if (recoveryStart !== null) recoveryPeriods.push({ startIndex: recoveryStart, endIndex: points.length - 1, open: true });

  return { points, bestGrowth, worstDrawdown, recoveryPeriods };
}

const equityHighlightPlugin = {
  id: 'tradoctoryEquityHighlights',
  beforeDatasetsDraw(chart, args, options) {
    const { ctx, chartArea, scales } = chart;
    const periods = options?.periods || [];
    if (!chartArea || !periods.length) return;
    ctx.save();
    periods.forEach((period) => {
      if (period.startIndex < 0 || period.endIndex < 0) return;
      const xStart = scales.x.getPixelForValue(period.startIndex);
      const xEnd = scales.x.getPixelForValue(period.endIndex);
      ctx.fillStyle = period.color;
      ctx.fillRect(Math.min(xStart, xEnd), chartArea.top, Math.max(Math.abs(xEnd - xStart), 8), chartArea.bottom - chartArea.top);
    });
    ctx.restore();
  }
};

function renderEquityCurve(trades) {
  if (!equityCurveChart) return;
  const model = buildEquityCurveModel(trades);
  const { points, bestGrowth, worstDrawdown, recoveryPeriods } = model;
  if (!points.length) {
    if (equityCurveInstance) {
      equityCurveInstance.destroy();
      equityCurveInstance = null;
    }
    equityCurveChart.innerHTML = '<div class="chart-empty">Log closed trades in your journal to build an equity curve.</div>';
    equityCurveInsights?.replaceChildren();
    return;
  }

  if (!equityCurveCanvas?.isConnected) {
    equityCurveChart.innerHTML = '<canvas id="equityCurveCanvas" aria-label="Equity curve showing growth, drawdowns, and recovery periods" role="img"></canvas>';
  }
  const canvas = document.getElementById('equityCurveCanvas');
  if (!window.Chart || !canvas) {
    equityCurveChart.innerHTML = '<div class="chart-empty">Equity chart library is still loading. Refresh to view the responsive curve.</div>';
    return;
  }

  const highlightPeriods = [
    ...recoveryPeriods.map((period) => ({ ...period, color: 'rgba(59, 130, 246, 0.08)' })),
    { ...bestGrowth, color: 'rgba(0, 210, 106, 0.10)' },
    { ...worstDrawdown, color: 'rgba(255, 77, 109, 0.12)' }
  ];
  const chartData = {
    labels: points.map((point) => point.label),
    datasets: [
      {
        label: 'Growth',
        data: points.map((point) => point.growth),
        borderColor: '#00d26a',
        backgroundColor: 'rgba(0, 210, 106, 0.14)',
        fill: true,
        tension: 0.32,
        pointRadius: 3,
        pointHoverRadius: 6,
        yAxisID: 'y'
      },
      {
        label: 'Drawdown',
        data: points.map((point) => point.drawdown),
        borderColor: '#ff4d6d',
        backgroundColor: 'rgba(255, 77, 109, 0.18)',
        fill: true,
        tension: 0.25,
        pointRadius: 0,
        yAxisID: 'y1'
      }
    ]
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#c9d4e5', usePointStyle: true } },
      tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}` } },
      tradoctoryEquityHighlights: { periods: highlightPeriods }
    },
    scales: {
      x: { ticks: { color: '#8090a8', maxRotation: 0, autoSkip: true }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#8090a8', callback: (value) => formatCurrency(value) }, grid: { color: 'rgba(255,255,255,0.06)' } },
      y1: { position: 'right', ticks: { color: '#ff8aa0', callback: (value) => formatCurrency(value) }, grid: { drawOnChartArea: false } }
    }
  };

  if (equityCurveInstance) {
    equityCurveInstance.data = chartData;
    equityCurveInstance.options = chartOptions;
    equityCurveInstance.update();
  } else {
    equityCurveInstance = new window.Chart(canvas.getContext('2d'), { type: 'line', data: chartData, options: chartOptions, plugins: [equityHighlightPlugin] });
  }

  if (equityCurveInsights) {
    equityCurveInsights.innerHTML = `
      <div><span>Best Growth Period</span><strong class="green">${formatCurrency(bestGrowth.value)}</strong><small>${escapeHtml(getPeriodLabel(points, bestGrowth))}</small></div>
      <div><span>Worst Drawdown</span><strong class="red">${formatCurrency(worstDrawdown.value)}</strong><small>${escapeHtml(getPeriodLabel(points, worstDrawdown))}</small></div>
      <div><span>Recovery Periods</span><strong class="blue">${recoveryPeriods.length}</strong><small>${recoveryPeriods.length ? `${recoveryPeriods.filter((period) => period.open).length} still recovering` : 'No drawdown recoveries yet'}</small></div>
    `;
  }
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
    if (!consistency.sampleSize) {
      factorsEl.innerHTML = '<div class="chart-empty">Log closed trades to build your consistency factors.</div>';
    } else {
      factorsEl.innerHTML = Object.entries(consistency.factors).map(([key, value]) => `
      <div class="consistency-factor">
        <div><span>${escapeHtml(formatFactorLabel(key))}</span><strong>${Math.round(value)}</strong></div>
        <div class="consistency-factor-track"><span style="width:${Math.max(value, 4)}%"></span></div>
      </div>
    `).join('');
    }
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

function getScannerTone(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('bull') || normalized === 'long' || normalized === 'success') return 'green';
  if (normalized.includes('bear') || normalized === 'short' || normalized === 'danger') return 'red';
  if (normalized === 'warning') return 'warning';
  return 'blue';
}

function renderScannerSignals(signals = []) {
  const signalsEl = document.getElementById('scannerSignals');
  if (!signalsEl) return;
  signalsEl.innerHTML = signals.map((signal) => {
    const tone = getScannerTone(signal.direction || signal.severity);
    return `<article class="scanner-signal ${tone}">
      <div>
        <div class="scanner-signal-title">
          <span>${escapeHtml(signal.title)}</span>
          <strong>${escapeHtml(signal.direction)}</strong>
        </div>
        <p>${escapeHtml(signal.message)}</p>
        <div class="scanner-signal-meta">
          <span>Trigger: ${escapeHtml(signal.trigger)}</span>
          <span>Risk: ${escapeHtml(signal.risk)}</span>
        </div>
      </div>
      <div class="scanner-signal-score">${Math.round(signal.confidence || 0)}%</div>
    </article>`;
  }).join('') || '<div class="chart-empty">No scanner signals available.</div>';
}

function renderScannerAlerts(alerts = []) {
  const alertsEl = document.getElementById('scannerAlerts');
  if (!alertsEl) return;
  alertsEl.innerHTML = alerts.map((alert) => {
    const tone = getScannerTone(alert.severity);
    return `<div class="scanner-alert ${tone}">
      <strong>${escapeHtml(alert.title)}</strong>
      <span>${escapeHtml(alert.message)}</span>
    </div>`;
  }).join('') || '<div class="chart-empty">No scanner alerts yet.</div>';
}

function renderScannerRiskNotes(notes = []) {
  const riskNotesEl = document.getElementById('scannerRiskNotes');
  if (!riskNotesEl) return;
  riskNotesEl.innerHTML = notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('');
}

function renderScannerSummary(scanResult, alerts, analytics) {
  const market = scanResult.market || {};
  const priceChangeClass = Number(market.change || 0) >= 0 ? 'green' : 'red';
  const confidence = Math.round(scanResult.confidence || 0);
  const biasEl = document.getElementById('scannerBias');
  const confidenceBar = document.getElementById('scannerConfidenceBar');
  const sourceBadge = document.getElementById('scannerSourceBadge');

  if (biasEl) {
    biasEl.classList.remove('green', 'red', 'blue');
    biasEl.classList.add(getScannerTone(scanResult.bias));
    biasEl.replaceChildren(scanResult.bias || 'Neutral');
  }

  document.getElementById('scannerBiasMeta')?.replaceChildren(`${analytics.headline} · ${analytics.signalCount} signal${analytics.signalCount === 1 ? '' : 's'}`);
  document.getElementById('scannerConfidence')?.replaceChildren(`${confidence}%`);
  if (confidenceBar) confidenceBar.style.width = `${Math.max(Math.min(confidence, 100), 4)}%`;
  document.getElementById('scannerPrice')?.replaceChildren(`${Number(market.price || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
  const priceChangeEl = document.getElementById('scannerPriceChange');
  if (priceChangeEl) {
    priceChangeEl.classList.remove('green', 'red');
    priceChangeEl.classList.add(priceChangeClass);
    priceChangeEl.replaceChildren(`${Number(market.change || 0) >= 0 ? '+' : ''}${Number(market.change || 0).toFixed(2)} (${Number(market.changePercent || 0).toFixed(2)}%) · Vol ${formatCompactNumber(market.volume)}`);
  }
  document.getElementById('scannerMarketStatus')?.replaceChildren(String(market.marketStatus || 'unknown').toUpperCase());
  document.getElementById('scannerTimestamp')?.replaceChildren(formatMarketTime(market.timestamp));
  if (sourceBadge) {
    sourceBadge.replaceChildren(`${analytics.status} · ${market.source || 'model'}`);
    sourceBadge.classList.toggle('muted', market.cacheStatus !== 'live');
  }
  renderScannerSignals(scanResult.signals);
  renderScannerAlerts(alerts);
  renderScannerRiskNotes(scanResult.riskNotes);
}

async function refreshScanner({ forceRefresh = false } = {}) {
  scannerRefreshBtn?.setAttribute('disabled', 'true');
  scannerRefreshBtn?.classList.add('is-loading');
  try {
    const scanResult = await scannerProvider.scan({ forceRefresh });
    const alerts = alertProvider.evaluate(scanResult);
    const analytics = scannerAnalyticsProvider.summarize(scanResult, alerts);
    renderScannerSummary(scanResult, alerts, analytics);
    const chartCanvas = document.getElementById('scannerScoreChart');
    const chartFallback = document.getElementById('scannerChartFallback');
    const chartRendered = scannerChartProvider.renderConfidenceChart(chartCanvas, scanResult);
    if (chartFallback) chartFallback.style.display = chartRendered ? 'none' : 'flex';
  } catch (error) {
    console.error('[Tradoctory] Nifty Beast scanner failed.', error);
    document.getElementById('scannerSignals')?.replaceChildren('Scanner temporarily unavailable. Please refresh the dashboard.');
  } finally {
    scannerRefreshBtn?.removeAttribute('disabled');
    scannerRefreshBtn?.classList.remove('is-loading');
  }
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
refreshScanner();
scannerRefreshBtn?.addEventListener('click', () => refreshScanner({ forceRefresh: true }));
