/* ===================================================
   TRADOCTORY — BEHAVIOR ANALYSIS PAGE  (analysis.js)
   =================================================== */
'use strict';

import { guardRoute, signOutAndRedirect } from './route-guard.js';
import { LocalTradeRepository } from './trades/local-trade-repository.js';
import { TradeService } from './trades/trade-service.js';
import { analyzeTradeBehavior } from './trades/trade-behavior-analysis.js';
import { analyzeTradeTime } from './trades/time-analysis.js';

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

/* ── 5. Rule-based trade behavior analysis ───────── */
const tradeRepository = new LocalTradeRepository({ userId: user.id || user.email });
const tradeService = new TradeService({ repository: tradeRepository, userId: user.id || user.email });

function formatCurrency(value) {
  const numericValue = Number(value) || 0;
  const sign = numericValue >= 0 ? '+' : '−';
  return `${sign}$${Math.abs(numericValue).toLocaleString()}`;
}

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

function getSeverityStyles(severity) {
  if (severity === 'danger') return 'border-left-color:var(--red);';
  if (severity === 'warning') return 'border-left-color:#f59e0b;';
  return '';
}

function getIconStyles(severity) {
  if (severity === 'danger') return 'background:var(--red-dim);color:var(--red);';
  if (severity === 'warning') return 'background:rgba(245,158,11,0.15);color:#f59e0b;';
  return '';
}

function renderObservation(observation) {
  return `<div class="ai-insight" style="${getSeverityStyles(observation.severity)}">
    <div class="ai-insight-icon" style="${getIconStyles(observation.severity)}">•</div>
    <div>${escapeHtml(observation.message)}</div>
  </div>`;
}

function averageRiskReward(trades) {
  const ratios = trades.map((trade) => Number(trade.riskRewardRatio) || 0).filter((ratio) => ratio > 0);
  if (!ratios.length) return 0;
  return Math.round((ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length) * 10) / 10;
}

function renderStats(report, trades) {
  const profitable = report.consistency.profitableDays.length;
  const totalDays = report.consistency.days.length;
  const dangerCount = report.observations.filter((observation) => observation.severity === 'danger').length;
  const warningCount = report.observations.filter((observation) => observation.severity === 'warning').length;
  const riskLabel = dangerCount ? 'High' : warningCount ? 'Medium' : 'Low';
  const riskEl = document.getElementById('behaviorRiskStat');

  document.getElementById('profitableDaysStat')?.replaceChildren(`${profitable}/${totalDays}`);
  document.getElementById('profitableDaysDelta')?.replaceChildren(totalDays ? `${Math.round((profitable / totalDays) * 100)}% profitable trading days` : 'Add trades to start tracking consistency');
  document.getElementById('patternsDetectedStat')?.replaceChildren(String(report.observations.length));
  riskEl?.replaceChildren(riskLabel);
  riskEl?.classList.toggle('green', riskLabel === 'Low');
  document.getElementById('behaviorRiskDelta')?.replaceChildren(`${report.overtrading.overtradedDays.length} overtrade days · ${report.revengeTrading.sequences.length} revenge sequences · ${report.fomoTrading.trades.length} FOMO trades`);
  document.getElementById('avgRiskRewardStat')?.replaceChildren(`${averageRiskReward(trades)}:1`);
}

const TRACKED_STRATEGIES = ['Breakout', 'VWAP', 'ORB', 'Pullback', 'Support Resistance'];
const TRACKED_EMOTIONS = ['Calm', 'Confident', 'Fear', 'Greed', 'FOMO', 'Revenge'];

function getStrategyLabel(trade) {
  return String(trade?.strategy || trade?.tradeData?.strategy || '').trim();
}

function getEmotionLabel(trade) {
  return String(trade?.emotion || trade?.emotionData?.emotion || '').trim();
}

function getClosedTrades(trades) {
  return trades.filter((trade) => ['Win', 'Loss', 'Breakeven'].includes(trade.tradeResult));
}

function calculateStrategyPerformance(trades) {
  return TRACKED_STRATEGIES.map((strategy) => {
    const strategyTrades = trades.filter((trade) => getStrategyLabel(trade).toLowerCase() === strategy.toLowerCase());
    const closedTrades = getClosedTrades(strategyTrades);
    const winningTrades = closedTrades.filter((trade) => trade.tradeResult === 'Win');
    const losingTrades = closedTrades.filter((trade) => trade.tradeResult === 'Loss');
    const totalPnl = strategyTrades.reduce((sum, trade) => sum + (Number(trade.profitLoss) || 0), 0);
    const winningPnl = winningTrades.reduce((sum, trade) => sum + (Number(trade.profitLoss) || 0), 0);
    const losingPnl = losingTrades.reduce((sum, trade) => sum + (Number(trade.profitLoss) || 0), 0);

    return {
      strategy,
      tradesTaken: strategyTrades.length,
      closedTrades: closedTrades.length,
      winRate: closedTrades.length ? Math.round((winningTrades.length / closedTrades.length) * 100) : 0,
      averageProfit: winningTrades.length ? winningPnl / winningTrades.length : 0,
      averageLoss: losingTrades.length ? losingPnl / losingTrades.length : 0,
      totalPnl
    };
  }).sort((a, b) => b.totalPnl - a.totalPnl || b.winRate - a.winRate || b.tradesTaken - a.tradesTaken || a.strategy.localeCompare(b.strategy));
}

function renderStrategyPerformanceDashboard(trades) {
  const tableBody = document.getElementById('strategyPerformanceTableBody');
  if (!tableBody) return;

  const rankedStrategies = calculateStrategyPerformance(trades);
  const activeStrategies = rankedStrategies.filter((strategy) => strategy.tradesTaken > 0);
  const bestStrategy = activeStrategies[0];
  const worstStrategy = activeStrategies.at(-1);

  document.getElementById('bestStrategyHighlight')?.replaceChildren(bestStrategy?.strategy || '—');
  document.getElementById('bestStrategyMeta')?.replaceChildren(bestStrategy ? `${formatCurrency(bestStrategy.totalPnl)} total P&L · ${bestStrategy.winRate}% win rate · ${bestStrategy.tradesTaken} trades` : 'Add trades to rank strategies.');
  document.getElementById('worstStrategyHighlight')?.replaceChildren(worstStrategy?.strategy || '—');
  document.getElementById('worstStrategyMeta')?.replaceChildren(worstStrategy ? `${formatCurrency(worstStrategy.totalPnl)} total P&L · ${worstStrategy.winRate}% win rate · ${worstStrategy.tradesTaken} trades` : 'Add trades to rank strategies.');
  document.getElementById('strategyRankingBadge')?.replaceChildren(activeStrategies.length ? `${activeStrategies.length}/${TRACKED_STRATEGIES.length} active strategies` : 'Ranked by Total P&L');

  const displayRows = [
    ...activeStrategies.map((strategy, index) => ({ ...strategy, rank: index + 1, isActive: true })),
    ...rankedStrategies.filter((strategy) => strategy.tradesTaken === 0).map((strategy) => ({ ...strategy, rank: null, isActive: false }))
  ];

  tableBody.innerHTML = displayRows.map((row) => {
    const isBest = bestStrategy && row.strategy === bestStrategy.strategy;
    const isWorst = worstStrategy && row.strategy === worstStrategy.strategy && activeStrategies.length > 1;
    const rowClass = isBest ? 'best-strategy-row' : isWorst ? 'worst-strategy-row' : '';
    const totalPnlColor = row.totalPnl >= 0 ? 'var(--accent)' : 'var(--red)';
    const winRateColor = row.winRate >= 50 ? 'var(--accent)' : row.closedTrades ? 'var(--red)' : 'var(--text-muted)';
    return `<tr class="${rowClass}">
      <td><span class="rank-pill">${row.rank ? `#${row.rank}` : '—'}</span></td>
      <td style="color:var(--text-primary);font-weight:700;">${escapeHtml(row.strategy)}${isBest ? ' <span class="tag win">Best</span>' : ''}${isWorst ? ' <span class="tag loss">Worst</span>' : ''}</td>
      <td>${row.tradesTaken}</td>
      <td style="color:${winRateColor};font-weight:700;">${row.winRate}%</td>
      <td style="color:var(--accent);font-weight:600;">${formatCurrency(row.averageProfit)}</td>
      <td style="color:${row.averageLoss < 0 ? 'var(--red)' : 'var(--text-muted)'};font-weight:600;">${formatCurrency(row.averageLoss)}</td>
      <td style="color:${totalPnlColor};font-weight:800;">${formatCurrency(row.totalPnl)}</td>
    </tr>`;
  }).join('');
}


function calculateEmotionAnalytics(trades) {
  const rows = TRACKED_EMOTIONS.map((emotion) => {
    const emotionTrades = trades.filter((trade) => getEmotionLabel(trade).toLowerCase() === emotion.toLowerCase());
    const closedTrades = getClosedTrades(emotionTrades);
    const wins = closedTrades.filter((trade) => trade.tradeResult === 'Win');
    const losses = closedTrades.filter((trade) => trade.tradeResult === 'Loss');
    const totalPnl = emotionTrades.reduce((sum, trade) => sum + (Number(trade.profitLoss) || 0), 0);

    return {
      emotion,
      tradesTaken: emotionTrades.length,
      closedTrades: closedTrades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: closedTrades.length ? Math.round((wins.length / closedTrades.length) * 100) : 0,
      lossRate: closedTrades.length ? Math.round((losses.length / closedTrades.length) * 100) : 0,
      totalPnl,
      averagePnl: emotionTrades.length ? totalPnl / emotionTrades.length : 0
    };
  });

  const activeRows = rows.filter((row) => row.tradesTaken > 0);
  const mostCommon = [...activeRows].sort((a, b) => b.tradesTaken - a.tradesTaken || b.closedTrades - a.closedTrades || a.emotion.localeCompare(b.emotion))[0];
  const bestPerforming = [...activeRows].sort((a, b) => b.totalPnl - a.totalPnl || b.winRate - a.winRate || b.tradesTaken - a.tradesTaken || a.emotion.localeCompare(b.emotion))[0];
  const worstPerforming = [...activeRows].sort((a, b) => a.totalPnl - b.totalPnl || a.winRate - b.winRate || b.tradesTaken - a.tradesTaken || a.emotion.localeCompare(b.emotion))[0];

  return { rows, activeRows, mostCommon, bestPerforming, worstPerforming };
}

function describeEmotionPerformance(emotion) {
  if (!emotion) return 'Add emotion tags to your trade journal to unlock emotion analytics.';
  return `${formatCurrency(emotion.totalPnl)} total P&L · ${emotion.winRate}% win rate · ${emotion.tradesTaken} trade${emotion.tradesTaken === 1 ? '' : 's'}`;
}

function buildEmotionObservations(analytics) {
  const observations = [];
  const fear = analytics.activeRows.find((row) => row.emotion === 'Fear');
  const calm = analytics.activeRows.find((row) => row.emotion === 'Calm');
  const reactive = analytics.activeRows.filter((row) => ['Fear', 'Greed', 'FOMO', 'Revenge'].includes(row.emotion) && row.closedTrades > 0);
  const disciplined = analytics.activeRows.filter((row) => ['Calm', 'Confident'].includes(row.emotion) && row.closedTrades > 0);

  if (fear?.closedTrades && calm?.closedTrades && fear.lossRate > calm.lossRate) {
    observations.push(`Fear-based trades lose ${fear.lossRate - calm.lossRate}% more often than Calm trades.`);
  }

  const highestWinRate = [...analytics.activeRows].filter((row) => row.closedTrades > 0).sort((a, b) => b.winRate - a.winRate || b.totalPnl - a.totalPnl)[0];
  if (highestWinRate) observations.push(`${highestWinRate.emotion} trades have the highest win rate at ${highestWinRate.winRate}%.`);

  const reactiveTotals = reactive.reduce((summary, row) => ({
    closedTrades: summary.closedTrades + row.closedTrades,
    losses: summary.losses + row.losses,
    totalPnl: summary.totalPnl + row.totalPnl
  }), { closedTrades: 0, losses: 0, totalPnl: 0 });
  const disciplinedTotals = disciplined.reduce((summary, row) => ({
    closedTrades: summary.closedTrades + row.closedTrades,
    losses: summary.losses + row.losses,
    totalPnl: summary.totalPnl + row.totalPnl
  }), { closedTrades: 0, losses: 0, totalPnl: 0 });

  if (reactiveTotals.closedTrades && disciplinedTotals.closedTrades) {
    const reactiveLossRate = Math.round((reactiveTotals.losses / reactiveTotals.closedTrades) * 100);
    const disciplinedLossRate = Math.round((disciplinedTotals.losses / disciplinedTotals.closedTrades) * 100);
    if (reactiveLossRate > disciplinedLossRate) observations.push(`Reactive emotions lose ${reactiveLossRate - disciplinedLossRate}% more often than Calm/Confident trades.`);
  }

  if (analytics.worstPerforming && analytics.worstPerforming.totalPnl < 0) observations.push(`${analytics.worstPerforming.emotion} is currently the biggest emotional drag at ${formatCurrency(analytics.worstPerforming.totalPnl)}.`);
  if (!observations.length) observations.push('Keep logging emotions before every trade to reveal stronger performance patterns.');
  return observations;
}

function renderEmotionAnalytics(trades) {
  const analytics = calculateEmotionAnalytics(trades);

  document.getElementById('mostCommonEmotionStat')?.replaceChildren(analytics.mostCommon?.emotion || '—');
  document.getElementById('mostCommonEmotionMeta')?.replaceChildren(analytics.mostCommon ? `${analytics.mostCommon.tradesTaken} logged trade${analytics.mostCommon.tradesTaken === 1 ? '' : 's'}` : 'No emotion-tagged trades yet.');
  document.getElementById('bestEmotionStat')?.replaceChildren(analytics.bestPerforming?.emotion || '—');
  document.getElementById('bestEmotionMeta')?.replaceChildren(describeEmotionPerformance(analytics.bestPerforming));
  document.getElementById('worstEmotionStat')?.replaceChildren(analytics.worstPerforming?.emotion || '—');
  document.getElementById('worstEmotionMeta')?.replaceChildren(describeEmotionPerformance(analytics.worstPerforming));

  const maxTrades = Math.max(...analytics.rows.map((row) => row.tradesTaken), 1);
  const chart = document.getElementById('emotionChart');
  if (chart) {
    chart.innerHTML = analytics.rows.map((row) => `<div class="emotion-chart-row">
      <div class="emotion-chart-label">${escapeHtml(row.emotion)}</div>
      <div class="emotion-chart-track"><div class="emotion-chart-fill ${row.totalPnl < 0 ? 'loss' : 'win'}" style="width:${Math.max((row.tradesTaken / maxTrades) * 100, row.tradesTaken ? 8 : 0)}%"></div></div>
      <div class="emotion-chart-value">${row.tradesTaken}</div>
    </div>`).join('');
  }

  const tableBody = document.getElementById('emotionPerformanceTableBody');
  if (tableBody) {
    tableBody.innerHTML = analytics.rows.map((row) => `<tr>
      <td style="color:var(--text-primary);font-weight:700;">${escapeHtml(row.emotion)}</td>
      <td>${row.tradesTaken}</td>
      <td style="color:${row.winRate >= 50 ? 'var(--accent)' : row.closedTrades ? 'var(--red)' : 'var(--text-muted)'};font-weight:700;">${row.winRate}%</td>
      <td style="color:${row.totalPnl >= 0 ? 'var(--accent)' : 'var(--red)'};font-weight:800;">${formatCurrency(row.totalPnl)}</td>
    </tr>`).join('');
  }

  const observations = document.getElementById('emotionObservationsList');
  if (observations) observations.innerHTML = buildEmotionObservations(analytics).map((message) => renderObservation({ severity: 'positive', message })).join('');
}




function getTradeDate(trade) {
  return trade?.tradeDate || trade?.tradeData?.tradeDate || trade?.createdAt?.slice?.(0, 10) || '';
}

function getWeekBounds(referenceDate = new Date()) {
  const date = new Date(referenceDate);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay() || 7;
  const start = new Date(date);
  start.setDate(date.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getWeekKey(date = new Date()) {
  const { start } = getWeekBounds(date);
  const yearStart = new Date(start.getFullYear(), 0, 1);
  const week = Math.ceil((((start - yearStart) / 86400000) + yearStart.getDay() + 1) / 7);
  return `${start.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isTradeInRange(trade, start, end) {
  const value = getTradeDate(trade);
  if (!value) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && date >= start && date <= end;
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = String(getKey(item) || '').trim();
    if (key) counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function getMostCommon(counts) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || null;
}

function describeTrade(trade) {
  if (!trade) return 'No closed trade yet.';
  const name = getTradeDisplayName(trade);
  const strategy = getStrategyLabel(trade) || 'No strategy';
  return `${name} · ${strategy} · ${formatCurrency(Number(trade.profitLoss) || 0)}`;
}

function calculateWeeklyReport(trades, referenceDate = new Date()) {
  const { start, end } = getWeekBounds(referenceDate);
  const weeklyTrades = trades.filter((trade) => isTradeInRange(trade, start, end));
  const closedTrades = getClosedTrades(weeklyTrades);
  const wins = closedTrades.filter((trade) => trade.tradeResult === 'Win');
  const losses = closedTrades.filter((trade) => trade.tradeResult === 'Loss');
  const weeklyPnl = weeklyTrades.reduce((sum, trade) => sum + (Number(trade.profitLoss) || 0), 0);
  const winRate = closedTrades.length ? Math.round((wins.length / closedTrades.length) * 100) : 0;
  const bestTrade = [...closedTrades].sort((a, b) => (Number(b.profitLoss) || 0) - (Number(a.profitLoss) || 0))[0] || null;
  const worstTrade = [...closedTrades].sort((a, b) => (Number(a.profitLoss) || 0) - (Number(b.profitLoss) || 0))[0] || null;
  const strategyRows = calculateStrategyPerformance(weeklyTrades).filter((row) => row.tradesTaken > 0);
  const bestStrategy = strategyRows[0] || null;
  const mostCommonEmotion = getMostCommon(countBy(weeklyTrades, getEmotionLabel));

  const achievements = [];
  const warnings = [];
  const recommendations = [];

  if (weeklyPnl > 0) achievements.push(`Finished the week positive at ${formatCurrency(weeklyPnl)}.`);
  if (winRate >= 60 && closedTrades.length) achievements.push(`Maintained a ${winRate}% win rate across ${closedTrades.length} closed trades.`);
  if (bestStrategy) achievements.push(`${bestStrategy.strategy} was your top strategy with ${formatCurrency(bestStrategy.totalPnl)} P&L.`);
  if (!achievements.length) achievements.push('A weekly report was generated. Keep logging trades to unlock stronger achievements.');

  if (weeklyPnl < 0) warnings.push(`Weekly P&L is negative at ${formatCurrency(weeklyPnl)}.`);
  if (closedTrades.length >= 3 && winRate < 45) warnings.push(`Win rate is below target at ${winRate}%.`);
  if (losses.length > wins.length && closedTrades.length) warnings.push('Losses outnumbered wins this week.');
  if (!weeklyTrades.length) warnings.push('No trades were logged for the current week.');
  if (!warnings.length) warnings.push('No major weekly warnings detected.');

  if (bestStrategy) recommendations.push(`Prioritize ${bestStrategy.strategy} setups next week and document why they worked.`);
  if (worstTrade && Number(worstTrade.profitLoss) < 0) recommendations.push(`Review ${getTradeDisplayName(worstTrade)} before the next session to identify the avoidable mistake.`);
  if (mostCommonEmotion) recommendations.push(`Your most common emotion was ${mostCommonEmotion[0]}; compare it against trade quality before increasing size.`);
  recommendations.push('Schedule a weekly review at market close to update rules, screenshots, and lessons learned.');

  return {
    schemaVersion: 'tradoctory.weekly-report.v1',
    generatedAt: new Date().toISOString(),
    weekKey: getWeekKey(referenceDate),
    dateRange: `${formatShortDate(start)} – ${formatShortDate(end)}`,
    weeklyTrades,
    closedTrades,
    weeklyPnl,
    winRate,
    bestTrade,
    worstTrade,
    bestStrategy,
    mostCommonEmotion: mostCommonEmotion ? { emotion: mostCommonEmotion[0], count: mostCommonEmotion[1] } : null,
    achievements,
    warnings,
    recommendations
  };
}

function persistWeeklyReport(report) {
  try {
    const storageKey = `tradoctory.weeklyReports.${user.id || user.email}`;
    const reports = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
    reports[report.weekKey] = {
      schemaVersion: report.schemaVersion,
      generatedAt: report.generatedAt,
      dateRange: report.dateRange,
      weeklyPnl: report.weeklyPnl,
      winRate: report.winRate,
      tradeCount: report.weeklyTrades.length,
      closedTradeCount: report.closedTrades.length,
      bestTradeId: report.bestTrade?.id || null,
      worstTradeId: report.worstTrade?.id || null,
      bestStrategy: report.bestStrategy?.strategy || null,
      mostCommonEmotion: report.mostCommonEmotion?.emotion || null
    };
    window.localStorage.setItem(storageKey, JSON.stringify(reports));
  } catch (error) {
    console.warn('Unable to persist weekly report snapshot.', error);
  }
}

function renderReportList(containerId, items, severity = 'positive') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = items.map((message) => renderObservation({ severity, message })).join('');
}

function renderWeeklyReportEngine(trades) {
  const report = calculateWeeklyReport(trades);
  persistWeeklyReport(report);
  document.getElementById('weeklyReportBadge')?.replaceChildren(`${report.weekKey} · Auto-generated`);
  document.getElementById('weeklyReportRange')?.replaceChildren(report.dateRange);
  document.getElementById('weeklyPnlStat')?.replaceChildren(formatCurrency(report.weeklyPnl));
  document.getElementById('weeklyPnlMeta')?.replaceChildren(`${report.weeklyTrades.length} trades this week`);
  document.getElementById('weeklyWinRateStat')?.replaceChildren(`${report.winRate}%`);
  document.getElementById('weeklyWinRateMeta')?.replaceChildren(`${report.closedTrades.length} closed · breakeven included in denominator`);
  document.getElementById('weeklyBestTradeStat')?.replaceChildren(report.bestTrade ? getTradeDisplayName(report.bestTrade) : '—');
  document.getElementById('weeklyBestTradeMeta')?.replaceChildren(describeTrade(report.bestTrade));
  document.getElementById('weeklyWorstTradeStat')?.replaceChildren(report.worstTrade ? getTradeDisplayName(report.worstTrade) : '—');
  document.getElementById('weeklyWorstTradeMeta')?.replaceChildren(describeTrade(report.worstTrade));
  document.getElementById('weeklyBestStrategyStat')?.replaceChildren(report.bestStrategy?.strategy || '—');
  document.getElementById('weeklyBestStrategyMeta')?.replaceChildren(report.bestStrategy ? `${formatCurrency(report.bestStrategy.totalPnl)} P&L · ${report.bestStrategy.winRate}% win rate` : 'No strategy trades this week.');
  document.getElementById('weeklyEmotionStat')?.replaceChildren(report.mostCommonEmotion?.emotion || '—');
  document.getElementById('weeklyEmotionMeta')?.replaceChildren(report.mostCommonEmotion ? `${report.mostCommonEmotion.count} trade${report.mostCommonEmotion.count === 1 ? '' : 's'} logged with this emotion` : 'No emotion-tagged trades this week.');
  renderReportList('weeklyAchievementsList', report.achievements, 'positive');
  renderReportList('weeklyWarningsList', report.warnings, report.warnings.some((item) => !item.startsWith('No major')) ? 'warning' : 'positive');
  renderReportList('weeklyRecommendationsList', report.recommendations, 'positive');
}

function roundTo(value, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function formatCurrencyAbsolute(value) {
  return `$${Math.abs(Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function getTradeRiskAmount(trade) {
  const explicitRisk = Number(trade?.riskData?.riskAmount ?? trade?.riskAmount);
  if (Number.isFinite(explicitRisk) && explicitRisk > 0) return roundTo(explicitRisk);

  const capital = Number(trade?.capital ?? trade?.riskData?.capital) || 0;
  const entryPrice = Number(trade?.entryPrice ?? trade?.riskData?.entryPrice) || 0;
  const stopLoss = Number(trade?.stopLoss ?? trade?.riskData?.stopLoss) || 0;
  if (!capital || !entryPrice || !stopLoss) return 0;

  return roundTo(Math.abs(entryPrice - stopLoss) * (capital / entryPrice));
}

function getTradeDisplayName(trade) {
  return String(trade?.tradeName || trade?.marketType || trade?.strategy || trade?.id || 'Unlabeled trade').trim();
}

function calculateRiskAnalytics(trades) {
  const riskRows = trades.map((trade) => ({
    trade,
    label: getTradeDisplayName(trade),
    riskAmount: getTradeRiskAmount(trade),
    riskRewardRatio: Number(trade?.riskRewardRatio ?? trade?.riskData?.riskRewardRatio) || 0,
    capital: Number(trade?.capital ?? trade?.riskData?.capital) || 0,
    profitLoss: Number(trade?.profitLoss ?? trade?.performanceData?.profitLoss) || 0,
    tradeResult: trade?.tradeResult || trade?.performanceData?.tradeResult || 'Open'
  })).filter((row) => row.riskAmount > 0);

  const totalRisk = riskRows.reduce((sum, row) => sum + row.riskAmount, 0);
  const averageRiskPerTrade = riskRows.length ? roundTo(totalRisk / riskRows.length) : 0;
  const highestRiskTrade = [...riskRows].sort((a, b) => b.riskAmount - a.riskAmount)[0] || null;
  const lowestRiskTrade = [...riskRows].sort((a, b) => a.riskAmount - b.riskAmount)[0] || null;
  const averageRiskRewardRatio = averageRiskReward(trades);
  const averageRiskPercent = riskRows.length ? roundTo(riskRows.reduce((sum, row) => sum + (row.capital ? (row.riskAmount / row.capital) * 100 : 0), 0) / riskRows.length) : 0;

  const highRiskSignals = [averageRiskPercent > 3, averageRiskRewardRatio > 0 && averageRiskRewardRatio < 1, highestRiskTrade?.capital && (highestRiskTrade.riskAmount / highestRiskTrade.capital) * 100 > 5].filter(Boolean).length;
  const mediumRiskSignals = [averageRiskPercent > 1.5, averageRiskRewardRatio > 0 && averageRiskRewardRatio < 1.5].filter(Boolean).length;
  const riskScore = highRiskSignals >= 2 || averageRiskPercent > 5 ? 'High Risk' : highRiskSignals || mediumRiskSignals ? 'Medium Risk' : 'Low Risk';

  return {
    schemaVersion: 'tradoctory.risk-analytics.v1',
    generatedAt: new Date().toISOString(),
    sampleSize: trades.length,
    riskDefinedTrades: riskRows.length,
    averageRiskPerTrade,
    highestRiskTrade,
    lowestRiskTrade,
    averageRiskRewardRatio,
    averageRiskPercent,
    riskScore,
    aiCompatibility: {
      featureVector: {
        averageRiskPerTrade,
        highestRiskAmount: highestRiskTrade?.riskAmount || 0,
        lowestRiskAmount: lowestRiskTrade?.riskAmount || 0,
        averageRiskRewardRatio,
        averageRiskPercent,
        riskScore
      },
      recommendationTargets: ['position_sizing', 'stop_loss_quality', 'risk_reward_quality', 'risk_consistency']
    }
  };
}

function buildRiskRecommendations(analytics) {
  if (!analytics.riskDefinedTrades) return ['Add entry price, stop loss, target, and capital to each trade so risk analytics can score your journal.'];
  const recommendations = [];
  if (analytics.averageRiskPercent > 3) recommendations.push(`Average risk is ${analytics.averageRiskPercent}% of capital. Consider reducing position size toward 1–2% per trade.`);
  if (analytics.averageRiskRewardRatio && analytics.averageRiskRewardRatio < 1.5) recommendations.push(`Average R:R is ${analytics.averageRiskRewardRatio}:1. Prioritize setups with at least 1.5:1 to 2:1 planned reward.`);
  if (analytics.highestRiskTrade && analytics.lowestRiskTrade && analytics.highestRiskTrade.riskAmount > analytics.lowestRiskTrade.riskAmount * 2) recommendations.push('Risk sizing varies widely. Standardize risk per trade before increasing volume.');
  if (analytics.riskScore === 'Low Risk') recommendations.push('Risk profile is controlled. Keep logging complete risk fields and review outliers weekly.');
  if (!recommendations.length) recommendations.push('Maintain consistent stop placement, target planning, and capital risk before every entry.');
  return recommendations;
}


function describeTimeMetric(metric, emptyText = 'Add timestamped trades to unlock this metric.') {
  if (!metric) return emptyText;
  const label = metric.windowLabel || metric.label || metric.date || '—';
  return `${label} · ${formatCurrency(metric.totalProfit)} total P&L · ${metric.winRate}% win rate · ${metric.trades} trade${metric.trades === 1 ? '' : 's'}`;
}

function renderTimeAnalysis(trades) {
  const analysis = analyzeTradeTime(trades);
  document.getElementById('mostProfitableHourStat')?.replaceChildren(analysis.mostProfitableHour?.windowLabel || '—');
  document.getElementById('mostProfitableHourMeta')?.replaceChildren(describeTimeMetric(analysis.mostProfitableHour));
  document.getElementById('leastProfitableHourStat')?.replaceChildren(analysis.leastProfitableHour?.windowLabel || '—');
  document.getElementById('leastProfitableHourMeta')?.replaceChildren(describeTimeMetric(analysis.leastProfitableHour));
  document.getElementById('mostProfitableDayStat')?.replaceChildren(analysis.mostProfitableDay?.label || '—');
  document.getElementById('mostProfitableDayMeta')?.replaceChildren(describeTimeMetric(analysis.mostProfitableDay, 'Add dated trades to unlock this metric.'));
  document.getElementById('worstTradingDayStat')?.replaceChildren(analysis.worstTradingDay?.date || '—');
  document.getElementById('worstTradingDayMeta')?.replaceChildren(analysis.worstTradingDay ? `${analysis.worstTradingDay.weekday} · ${formatCurrency(analysis.worstTradingDay.totalProfit)} total P&L · ${analysis.worstTradingDay.trades} trade${analysis.worstTradingDay.trades === 1 ? '' : 's'}` : 'Add dated trades to unlock this metric.');
  document.getElementById('timeAnalysisBadge')?.replaceChildren(`${analysis.timestampedTrades}/${analysis.sampleSize} timestamped trades`);

  const recommendations = document.getElementById('timeRecommendationsList');
  if (recommendations) recommendations.innerHTML = analysis.recommendations.map((message) => renderObservation({ severity: message.toLowerCase().includes('avoid') || message.toLowerCase().includes('worst') ? 'warning' : 'positive', message })).join('');

  const tableBody = document.getElementById('timeHourlyTableBody');
  if (tableBody) {
    const rows = analysis.hourlyRanking.slice(0, 6);
    tableBody.innerHTML = rows.length ? rows.map((row) => `<tr>
      <td style="color:var(--text-primary);font-weight:700;">${escapeHtml(row.windowLabel)}</td>
      <td>${row.trades}</td>
      <td style="color:${row.winRate >= 50 ? 'var(--accent)' : 'var(--red)'};font-weight:700;">${row.winRate}%</td>
      <td style="color:${row.totalProfit >= 0 ? 'var(--accent)' : 'var(--red)'};font-weight:800;">${formatCurrency(row.totalProfit)}</td>
    </tr>`).join('') : '<tr><td colspan="4">No timestamped trades yet.</td></tr>';
  }
}

function renderRiskAnalytics(trades) {
  const analytics = calculateRiskAnalytics(trades);
  const scoreEl = document.getElementById('riskScoreLabel');
  const panel = document.getElementById('riskScorePanel');
  const scoreClass = analytics.riskScore === 'High Risk' ? 'high' : analytics.riskScore === 'Medium Risk' ? 'medium' : 'low';
  panel?.classList.remove('low', 'medium', 'high');
  panel?.classList.add(scoreClass);
  scoreEl?.replaceChildren(analytics.riskScore);
  document.getElementById('riskScoreMeta')?.replaceChildren(`${analytics.riskDefinedTrades}/${analytics.sampleSize} trades with defined risk · avg ${analytics.averageRiskPercent}% capital at risk`);
  document.getElementById('averageRiskPerTradeStat')?.replaceChildren(formatCurrencyAbsolute(analytics.averageRiskPerTrade));
  document.getElementById('highestRiskTradeStat')?.replaceChildren(formatCurrencyAbsolute(analytics.highestRiskTrade?.riskAmount || 0));
  document.getElementById('highestRiskTradeMeta')?.replaceChildren(analytics.highestRiskTrade?.label || 'No risk-defined trades yet.');
  document.getElementById('lowestRiskTradeStat')?.replaceChildren(formatCurrencyAbsolute(analytics.lowestRiskTrade?.riskAmount || 0));
  document.getElementById('lowestRiskTradeMeta')?.replaceChildren(analytics.lowestRiskTrade?.label || 'No risk-defined trades yet.');
  document.getElementById('riskAverageRiskRewardStat')?.replaceChildren(`${analytics.averageRiskRewardRatio}:1`);
  document.getElementById('riskAnalyticsBadge')?.replaceChildren(`${analytics.schemaVersion} · AI-ready`);

  const recommendations = document.getElementById('riskRecommendationsList');
  if (recommendations) recommendations.innerHTML = buildRiskRecommendations(analytics).map((message) => renderObservation({ severity: analytics.riskScore === 'High Risk' ? 'danger' : analytics.riskScore === 'Medium Risk' ? 'warning' : 'positive', message })).join('');

  const payload = document.getElementById('riskAnalyticsAiPayload');
  if (payload) payload.textContent = JSON.stringify({ ...analytics, highestRiskTrade: analytics.highestRiskTrade && { label: analytics.highestRiskTrade.label, riskAmount: analytics.highestRiskTrade.riskAmount }, lowestRiskTrade: analytics.lowestRiskTrade && { label: analytics.lowestRiskTrade.label, riskAmount: analytics.lowestRiskTrade.riskAmount } });
}

function renderPerformanceByPair(trades) {
  const tableBody = document.getElementById('performanceTableBody');
  if (!tableBody) return;

  const byPair = trades.reduce((groups, trade) => {
    const key = trade.tradeName || trade.marketType || 'Unlabeled';
    groups[key] = groups[key] || [];
    groups[key].push(trade);
    return groups;
  }, {});

  const rows = Object.entries(byPair).map(([pair, pairTrades]) => {
    const closed = pairTrades.filter((trade) => ['Win', 'Loss', 'Breakeven'].includes(trade.tradeResult));
    const wins = closed.filter((trade) => trade.tradeResult === 'Win').length;
    const pnl = pairTrades.reduce((sum, trade) => sum + (Number(trade.profitLoss) || 0), 0);
    const avgRr = averageRiskReward(pairTrades);
    return { pair, trades: pairTrades.length, winRate: closed.length ? Math.round((wins / closed.length) * 100) : 0, pnl, avgRr };
  }).sort((a, b) => b.pnl - a.pnl).slice(0, 5);

  tableBody.innerHTML = rows.length ? rows.map((row) => {
    const pnlClass = row.pnl >= 0 ? 'var(--accent)' : 'var(--red)';
    return `<tr>
      <td style="color:var(--text-primary);font-weight:600;">${escapeHtml(row.pair)}</td>
      <td>${row.trades}</td>
      <td style="color:${row.winRate >= 50 ? 'var(--accent)' : 'var(--red)'};font-weight:600;">${row.winRate}%</td>
      <td style="color:${pnlClass};font-weight:600;">${formatCurrency(row.pnl)}</td>
      <td>${row.avgRr}:1</td>
    </tr>`;
  }).join('') : '<tr><td colspan="5">No trades logged yet.</td></tr>';
}

function renderImprovementPlan(report) {
  const plan = document.getElementById('improvementPlanList');
  if (!plan) return;

  const recommendations = [];
  if (report.overtrading.overtradedDays.length) recommendations.push(`Limit to ${report.rules.overtradeDailyLimit} trades/day to control overtrading.`);
  if (report.revengeTrading.sequences.length) recommendations.push(`Pause after ${report.rules.revengeLossStreak} losses before taking another trade.`);
  if (report.fomoTrading.lowRiskRewardTrades.length) recommendations.push(`Avoid entries below ${report.rules.fomoRiskRewardThreshold}:1 R:R unless your plan explicitly allows them.`);
  if (report.fomoTrading.emotionDrivenTrades.length) recommendations.push('When FOMO-like emotions appear, verify the setup against your written plan before entering.');
  recommendations.push('Review profitable days weekly and repeat the strategy, emotion, and market conditions that worked.');

  plan.innerHTML = recommendations.map((text, index) => `<div style="display:flex;gap:12px;align-items:flex-start;">
    <div style="width:22px;height:22px;border-radius:50%;background:var(--accent-dim);color:var(--accent);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${index + 1}</div>
    <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;">${escapeHtml(text)}</div>
  </div>`).join('');
}

function renderReport(report, trades) {
  renderStats(report, trades);
  document.getElementById('keyInsightsList')?.replaceChildren();
  const keyInsights = document.getElementById('keyInsightsList');
  if (keyInsights) keyInsights.innerHTML = report.observations.map(renderObservation).join('');

  const psychology = document.getElementById('psychologyPatternsList');
  if (psychology) {
    const psychologyObservations = report.observations.filter((observation) => ['revenge-trading', 'fomo-trading', 'emotion', 'overtrading'].includes(observation.type));
    psychology.innerHTML = psychologyObservations.length ? psychologyObservations.map(renderObservation).join('') : renderObservation({ severity: 'positive', message: 'No psychology risk pattern has enough evidence yet.' });
  }

  renderStrategyPerformanceDashboard(trades);
  renderWeeklyReportEngine(trades);
  renderEmotionAnalytics(trades);
  renderRiskAnalytics(trades);
  renderTimeAnalysis(trades);
  renderPerformanceByPair(trades);
  renderImprovementPlan(report);
}

async function initializeAnalysis() {
  const trades = await tradeService.listTrades();
  renderReport(analyzeTradeBehavior(trades), trades);
}

initializeAnalysis();
