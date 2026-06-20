'use strict';

import { isClosedTrade, toNumber } from './trade.js';
import { generateTradeAnalytics } from './trade-analytics.js';

export const AI_COACH_SCHEMA_VERSION = 'tradoctory.ai-coach.v1';
export const AI_COACH_ENGINE = 'local-rule-engine';

function roundTo(value, precision = 1) {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function getTradePnl(trade) {
  return toNumber(trade?.profitLoss ?? trade?.performanceData?.profitLoss);
}

function summarizeClosedTrades(trades) {
  const closedTrades = trades.filter(isClosedTrade);
  const wins = closedTrades.filter((trade) => (trade.tradeResult || trade.performanceData?.tradeResult) === 'Win');
  const losses = closedTrades.filter((trade) => (trade.tradeResult || trade.performanceData?.tradeResult) === 'Loss');
  const totalWin = wins.reduce((sum, trade) => sum + Math.max(getTradePnl(trade), 0), 0);
  const totalLoss = losses.reduce((sum, trade) => sum + Math.abs(Math.min(getTradePnl(trade), 0)), 0);

  return {
    closedTrades,
    wins,
    losses,
    winRate: closedTrades.length ? roundTo((wins.length / closedTrades.length) * 100) : 0,
    averageWin: wins.length ? roundTo(totalWin / wins.length, 2) : 0,
    averageLoss: losses.length ? roundTo(totalLoss / losses.length, 2) : 0,
    profitFactor: totalLoss ? roundTo(totalWin / totalLoss, 2) : totalWin ? Infinity : 0
  };
}

function addUnique(items, item) {
  if (!item?.message || items.some((existing) => existing.message === item.message)) return;
  items.push(item);
}

function getLossRecoverySignals(closedTrades) {
  const sorted = [...closedTrades].sort((a, b) => Date.parse(a.tradeDate || a.createdAt || '') - Date.parse(b.tradeDate || b.createdAt || ''));
  let afterLossTrades = 0;
  let afterLossLosses = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if ((previous.tradeResult || previous.performanceData?.tradeResult) !== 'Loss') continue;
    afterLossTrades += 1;
    if ((current.tradeResult || current.performanceData?.tradeResult) === 'Loss') afterLossLosses += 1;
  }
  return { afterLossTrades, afterLossLosses, afterLossLossRate: afterLossTrades ? roundTo((afterLossLosses / afterLossTrades) * 100) : 0 };
}

export function generateAiCoachReport(trades = [], options = {}) {
  const validTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const analytics = generateTradeAnalytics(validTrades);
  const summary = summarizeClosedTrades(validTrades);
  const strengths = [];
  const weaknesses = [];
  const actionPlan = [];
  const topStrategy = analytics.strategyRanking[0];
  const worstStrategy = [...analytics.strategyRanking].reverse().find((strategy) => strategy.totalProfit < 0 || strategy.winRate < 45);
  const riskScore = analytics.riskAnalytics?.riskScore || '';
  const lossSignals = getLossRecoverySignals(summary.closedTrades);

  if (!validTrades.length) {
    return {
      schemaVersion: AI_COACH_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      engine: AI_COACH_ENGINE,
      provider: 'none',
      gptReady: true,
      sampleSize: 0,
      headline: 'Log trades to unlock your AI Coach.',
      strengths: ['Journal structure is ready for local coaching once trades are added.'],
      weaknesses: ['No trading history is available for personalized feedback yet.'],
      actionPlan: ['Add at least 10 trades with strategy, result, risk, emotion, and date fields.'],
      diagnostics: { analytics, summary, lossSignals },
      futureGptPayload: { schemaVersion: AI_COACH_SCHEMA_VERSION, promptContext: null, featureVector: analytics }
    };
  }

  if (summary.winRate >= 55 && summary.closedTrades.length >= 5) addUnique(strengths, { message: `Your win rate is strong at ${summary.winRate}% across ${summary.closedTrades.length} closed trades.` });
  if (topStrategy?.trades >= 2 && topStrategy.totalProfit > 0) addUnique(strengths, { message: `You perform best using ${topStrategy.label} setups (${topStrategy.winRate}% win rate, ${topStrategy.totalProfit} total P&L).` });
  if (analytics.consistencyScore >= 70) addUnique(strengths, { message: `Consistency is a strength: your current score is ${Math.round(analytics.consistencyScore)}/100.` });
  if (riskScore === 'Low Risk') addUnique(strengths, { message: 'Risk management looks controlled on trades with complete risk data.' });

  if (summary.averageLoss > summary.averageWin && summary.losses.length) addUnique(weaknesses, { message: `Your win rate can be useful, but losses are too large: average loss is $${summary.averageLoss} versus $${summary.averageWin} average win.` });
  if (riskScore === 'High Risk' || riskScore === 'Medium Risk') addUnique(weaknesses, { message: 'Risk management needs improvement based on position size, stop-loss, and R:R signals.' });
  if (!analytics.riskAnalytics?.riskDefinedTrades) addUnique(weaknesses, { message: 'Risk quality cannot be scored yet because trades are missing capital, entry, stop-loss, or risk data.' });
  if (lossSignals.afterLossTrades >= 3 && lossSignals.afterLossLossRate >= 50) addUnique(weaknesses, { message: `You tend to struggle after losses: ${lossSignals.afterLossLossRate}% of trades after a loss also lost.` });
  if (worstStrategy) addUnique(weaknesses, { message: `${worstStrategy.label} setups are underperforming and should be reviewed before scaling.` });
  if (analytics.timeAnalysis?.timestampedTrades === 0) addUnique(weaknesses, { message: 'Execution-time recommendations are unavailable until trades include explicit entry or execution timestamps.' });

  if (topStrategy?.trades >= 2) addUnique(actionPlan, { message: `Prioritize ${topStrategy.label} setups and document the exact entry checklist that makes them work.` });
  if (summary.averageLoss > summary.averageWin) addUnique(actionPlan, { message: 'Cap each planned loss before entry and avoid moving stops farther away after execution.' });
  if (!analytics.riskAnalytics?.riskDefinedTrades) addUnique(actionPlan, { message: 'Complete capital, entry, stop-loss, and target fields for future trades so risk can be scored accurately.' });
  if (lossSignals.afterLossTrades >= 3) addUnique(actionPlan, { message: 'After any losing trade, take a mandatory pause and write one mistake/lesson before entering again.' });
  addUnique(actionPlan, { message: 'Review Strengths, Weaknesses, and Action Plan weekly; this module is local-rule-based and ready for a future GPT provider adapter.' });

  if (!strengths.length) addUnique(strengths, { message: 'You have enough journal structure to start detecting repeatable edges; keep adding complete trades.' });
  if (!weaknesses.length) addUnique(weaknesses, { message: 'No major weakness has enough evidence yet; continue logging complete trades to improve confidence.' });

  return {
    schemaVersion: AI_COACH_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    engine: options.engine || AI_COACH_ENGINE,
    provider: 'none',
    gptReady: true,
    sampleSize: validTrades.length,
    headline: strengths[0]?.message || 'Rule-based AI Coach report generated.',
    strengths: strengths.map((item) => item.message),
    weaknesses: weaknesses.map((item) => item.message),
    actionPlan: actionPlan.map((item) => item.message),
    diagnostics: { analytics, summary, lossSignals },
    futureGptPayload: {
      schemaVersion: AI_COACH_SCHEMA_VERSION,
      providerAdapter: 'reserved-for-future-gpt-integration',
      promptContext: { objective: 'personalized_trading_feedback', sections: ['strengths', 'weaknesses', 'actionPlan'] },
      featureVector: analytics
    }
  };
}
