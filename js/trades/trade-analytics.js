'use strict';

import { isClosedTrade, toNumber } from './trade.js';

export const TRADE_ANALYTICS_SCHEMA_VERSION = 'tradoctory.trade-analytics.v1';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function roundTo(value, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function getTradeDay(trade) {
  return String(trade?.tradeDate || trade?.createdAt?.slice(0, 10) || 'Unknown');
}

function getWeekdayName(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Unknown' : WEEKDAYS[date.getUTCDay()];
}

function increment(map, key, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function getMostCommon(map, fallback = '') {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0]?.[0] || fallback;
}

function summarizeGroup(label, trades) {
  const closedTrades = trades.filter(isClosedTrade);
  const wins = closedTrades.filter((trade) => trade.tradeResult === 'Win').length;
  const totalProfit = trades.reduce((sum, trade) => sum + toNumber(trade?.profitLoss), 0);

  return {
    label,
    trades: trades.length,
    closedTrades: closedTrades.length,
    winRate: closedTrades.length ? roundTo((wins / closedTrades.length) * 100, 1) : 0,
    totalProfit: roundTo(totalProfit),
    averageProfit: trades.length ? roundTo(totalProfit / trades.length) : 0
  };
}

function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    if (!key) return groups;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());
}

function getStrategyRanking(trades) {
  return [...groupBy(trades, (trade) => trade?.strategy).entries()]
    .map(([strategy, strategyTrades]) => summarizeGroup(strategy, strategyTrades))
    .sort((a, b) => b.totalProfit - a.totalProfit || b.winRate - a.winRate || b.trades - a.trades);
}

function getMostProfitableDay(trades) {
  const dayRanking = [...groupBy(trades, getTradeDay).entries()]
    .map(([date, dayTrades]) => ({
      date,
      weekday: getWeekdayName(date),
      ...summarizeGroup(date, dayTrades)
    }))
    .sort((a, b) => b.totalProfit - a.totalProfit || b.winRate - a.winRate || b.trades - a.trades);

  const bestDay = dayRanking[0];
  if (!bestDay) return { date: '', weekday: '', totalProfit: 0, trades: 0 };
  return {
    date: bestDay.date,
    weekday: bestDay.weekday,
    totalProfit: bestDay.totalProfit,
    trades: bestDay.trades
  };
}

function calculateConsistencyScore(trades) {
  const closedTrades = trades.filter(isClosedTrade);
  if (!closedTrades.length) return 0;

  const profitableDays = [...groupBy(trades, getTradeDay).values()].filter((dayTrades) => (
    dayTrades.reduce((sum, trade) => sum + toNumber(trade?.profitLoss), 0) > 0
  )).length;
  const totalDays = groupBy(trades, getTradeDay).size || 1;
  const winRate = closedTrades.filter((trade) => trade.tradeResult === 'Win').length / closedTrades.length;
  const profitableDayRate = profitableDays / totalDays;
  const positiveExpectancyRate = trades.filter((trade) => toNumber(trade?.profitLoss) >= 0).length / trades.length;

  return roundTo(((winRate * 0.45) + (profitableDayRate * 0.35) + (positiveExpectancyRate * 0.2)) * 100, 1);
}

export function generateTradeAnalytics(trades = []) {
  const validTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const strategyRanking = getStrategyRanking(validTrades);
  const riskRewards = validTrades.map((trade) => toNumber(trade?.riskRewardRatio)).filter((ratio) => ratio > 0);
  const emotions = new Map();
  validTrades.forEach((trade) => increment(emotions, String(trade?.emotion || '').trim()));

  return {
    schemaVersion: TRADE_ANALYTICS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sampleSize: validTrades.length,
    bestStrategy: strategyRanking[0]?.label || '',
    worstStrategy: strategyRanking.at(-1)?.label || '',
    averageRiskReward: riskRewards.length ? roundTo(riskRewards.reduce((sum, ratio) => sum + ratio, 0) / riskRewards.length) : 0,
    mostProfitableDay: getMostProfitableDay(validTrades),
    mostCommonEmotion: getMostCommon(emotions),
    consistencyScore: calculateConsistencyScore(validTrades),
    strategyRanking,
    featureReadiness: {
      aiCoach: true,
      traderPersonalityDetection: true,
      weeklyReports: true,
      performanceInsights: true,
      machineLearningReady: true
    }
  };
}
