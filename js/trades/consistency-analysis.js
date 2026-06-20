'use strict';

import { isClosedTrade, toNumber } from './trade.js';

export const CONSISTENCY_SCHEMA_VERSION = 'tradoctory.consistency.v1';

const DISCIPLINED_EMOTIONS = new Set(['calm', 'confident', 'focused', 'patient', 'neutral']);
const REACTIVE_EMOTIONS = new Set(['fear', 'greed', 'anxious', 'anxiety', 'angry', 'frustrated', 'fomo', 'revenge', 'stressed', 'panic']);

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value, precision = 1) {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function parseTradeTime(trade) {
  const rawDate = trade?.tradeDate || trade?.createdAt;
  const date = new Date(String(rawDate || '').includes('T') ? rawDate : `${rawDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getTradeDay(trade) {
  return String(trade?.tradeDate || trade?.createdAt?.slice(0, 10) || 'Unknown');
}

function calculateWinRateScore(closedTrades) {
  if (!closedTrades.length) return 0;
  const wins = closedTrades.filter((trade) => String(trade.tradeResult).toLowerCase() === 'win').length;
  return (wins / closedTrades.length) * 100;
}

function calculateRiskManagementScore(closedTrades) {
  if (!closedTrades.length) return 0;
  const riskScores = closedTrades.map((trade) => {
    const ratio = toNumber(trade?.riskRewardRatio);
    const hasStopLoss = toNumber(trade?.stopLoss) > 0;
    const hasTarget = toNumber(trade?.target) > 0;
    const returnPercent = Math.abs(toNumber(trade?.performanceData?.returnPercent));
    const ratioScore = clamp((ratio / 2) * 70, 0, 70);
    const planningScore = (hasStopLoss ? 15 : 0) + (hasTarget ? 10 : 0);
    const oversizedPenalty = returnPercent > 8 ? 15 : returnPercent > 5 ? 8 : 0;
    return clamp(ratioScore + planningScore + 5 - oversizedPenalty);
  });
  return riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length;
}

function calculateTradeFrequencyScore(closedTrades) {
  if (closedTrades.length < 2) return closedTrades.length ? 45 : 0;
  const days = new Set(closedTrades.map(getTradeDay)).size || 1;
  const tradesPerDay = closedTrades.length / days;
  if (tradesPerDay <= 1.5) return 100;
  if (tradesPerDay <= 3) return 85;
  if (tradesPerDay <= 5) return 65;
  if (tradesPerDay <= 8) return 45;
  return 25;
}

function calculateEmotionalStabilityScore(closedTrades) {
  const emotionalTrades = closedTrades.filter((trade) => String(trade?.emotion || '').trim());
  if (!emotionalTrades.length) return 50;
  const scores = emotionalTrades.map((trade) => {
    const emotion = String(trade.emotion || '').trim().toLowerCase();
    if (DISCIPLINED_EMOTIONS.has(emotion)) return 100;
    if (REACTIVE_EMOTIONS.has(emotion)) return 35;
    return 70;
  });
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function calculateStrategyDisciplineScore(closedTrades) {
  if (!closedTrades.length) return 0;
  const plannedTrades = closedTrades.filter((trade) => String(trade?.strategy || '').trim()).length;
  const journaledTrades = closedTrades.filter((trade) => String(trade?.notes || '').trim() || (Array.isArray(trade?.tags) && trade.tags.length)).length;
  return ((plannedTrades / closedTrades.length) * 70) + ((journaledTrades / closedTrades.length) * 30);
}

function getTrend(currentScore, previousScore) {
  if (previousScore === null) return { label: 'Building baseline', direction: 'flat', delta: 0 };
  const delta = roundTo(currentScore - previousScore, 1);
  if (delta >= 3) return { label: `Improving +${delta}`, direction: 'up', delta };
  if (delta <= -3) return { label: `Declining ${delta}`, direction: 'down', delta };
  return { label: `Stable ${delta >= 0 ? '+' : ''}${delta}`, direction: 'flat', delta };
}

function getEmptyConsistencyResult() {
  return {
    score: 0,
    factors: {
      winRate: 0,
      riskManagement: 0,
      tradeFrequency: 0,
      emotionalStability: 0,
      strategyDiscipline: 0
    },
    suggestions: ['Log closed trades to build your consistency baseline.']
  };
}

function buildSuggestions(factors) {
  const suggestions = [];
  if (factors.winRate < 50) suggestions.push('Review losing setups and pause strategies that remain below a 50% win rate.');
  if (factors.riskManagement < 70) suggestions.push('Define stop loss, target, and minimum 1.5:1 risk/reward before entering each trade.');
  if (factors.tradeFrequency < 70) suggestions.push('Reduce overtrading by setting a max trades-per-day rule and waiting for A+ setups.');
  if (factors.emotionalStability < 70) suggestions.push('Log your emotion before entry and avoid trades marked fear, greed, FOMO, or revenge.');
  if (factors.strategyDiscipline < 70) suggestions.push('Attach every trade to a named strategy and add notes or tags for post-trade review.');
  if (!suggestions.length) suggestions.push('Maintain your current process and keep logging complete trade details after every execution.');
  return suggestions.slice(0, 4);
}

function scoreTrades(trades) {
  const closedTrades = trades.filter(isClosedTrade);
  const factors = {
    winRate: calculateWinRateScore(closedTrades),
    riskManagement: calculateRiskManagementScore(closedTrades),
    tradeFrequency: calculateTradeFrequencyScore(closedTrades),
    emotionalStability: calculateEmotionalStabilityScore(closedTrades),
    strategyDiscipline: calculateStrategyDisciplineScore(closedTrades)
  };
  const score = (factors.winRate * 0.25)
    + (factors.riskManagement * 0.25)
    + (factors.tradeFrequency * 0.15)
    + (factors.emotionalStability * 0.15)
    + (factors.strategyDiscipline * 0.20);
  return { score: roundTo(score), factors: Object.fromEntries(Object.entries(factors).map(([key, value]) => [key, roundTo(value)])) };
}

export function analyzeConsistency(trades = []) {
  const validTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const closedTrades = validTrades.filter(isClosedTrade).sort((a, b) => parseTradeTime(a) - parseTradeTime(b));

  if (!closedTrades.length) {
    const empty = getEmptyConsistencyResult();
    return {
      schemaVersion: CONSISTENCY_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      score: empty.score,
      trend: getTrend(empty.score, null),
      factors: empty.factors,
      suggestions: empty.suggestions,
      sampleSize: 0
    };
  }

  const current = scoreTrades(closedTrades);
  const midpoint = Math.floor(closedTrades.length / 2);
  const previousScore = midpoint >= 3 ? scoreTrades(closedTrades.slice(0, midpoint)).score : null;

  return {
    schemaVersion: CONSISTENCY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    score: clamp(current.score),
    trend: getTrend(current.score, previousScore),
    factors: current.factors,
    suggestions: buildSuggestions(current.factors),
    sampleSize: closedTrades.length
  };
}
