/* ===================================================
   TRADOCTORY — BEHAVIOR ANALYSIS PAGE  (analysis.js)
   =================================================== */
'use strict';

import { guardRoute, signOutAndRedirect } from './route-guard.js';
import { LocalTradeRepository } from './trades/local-trade-repository.js';
import { TradeService } from './trades/trade-service.js';
import { analyzeTradeBehavior } from './trades/trade-behavior-analysis.js';

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

function getStrategyLabel(trade) {
  return String(trade?.strategy || trade?.tradeData?.strategy || '').trim();
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

  tableBody.innerHTML = rankedStrategies.map((row, index) => {
    const isBest = bestStrategy && row.strategy === bestStrategy.strategy;
    const isWorst = worstStrategy && row.strategy === worstStrategy.strategy && activeStrategies.length > 1;
    const rowClass = isBest ? 'best-strategy-row' : isWorst ? 'worst-strategy-row' : '';
    const totalPnlColor = row.totalPnl >= 0 ? 'var(--accent)' : 'var(--red)';
    const winRateColor = row.winRate >= 50 ? 'var(--accent)' : row.closedTrades ? 'var(--red)' : 'var(--text-muted)';
    return `<tr class="${rowClass}">
      <td><span class="rank-pill">#${index + 1}</span></td>
      <td style="color:var(--text-primary);font-weight:700;">${escapeHtml(row.strategy)}${isBest ? ' <span class="tag win">Best</span>' : ''}${isWorst ? ' <span class="tag loss">Worst</span>' : ''}</td>
      <td>${row.tradesTaken}</td>
      <td style="color:${winRateColor};font-weight:700;">${row.winRate}%</td>
      <td style="color:var(--accent);font-weight:600;">${formatCurrency(row.averageProfit)}</td>
      <td style="color:${row.averageLoss < 0 ? 'var(--red)' : 'var(--text-muted)'};font-weight:600;">${formatCurrency(row.averageLoss)}</td>
      <td style="color:${totalPnlColor};font-weight:800;">${formatCurrency(row.totalPnl)}</td>
    </tr>`;
  }).join('');
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
  renderPerformanceByPair(trades);
  renderImprovementPlan(report);
}

async function initializeAnalysis() {
  const trades = await tradeService.listTrades();
  renderReport(analyzeTradeBehavior(trades), trades);
}

initializeAnalysis();
