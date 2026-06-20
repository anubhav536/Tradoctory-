'use strict';

import { isClosedTrade, toNumber } from './trade.js';
import { analyzeConsistency } from './consistency-analysis.js';

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


function getTradeRiskAmount(trade) {
  const explicitRisk = toNumber(trade?.riskData?.riskAmount ?? trade?.riskAmount);
  if (explicitRisk > 0) return roundTo(explicitRisk);

  const capital = toNumber(trade?.capital ?? trade?.riskData?.capital);
  const entryPrice = toNumber(trade?.entryPrice ?? trade?.riskData?.entryPrice);
  const stopLoss = toNumber(trade?.stopLoss ?? trade?.riskData?.stopLoss);
  if (!capital || !entryPrice || !stopLoss) return 0;

  return roundTo(Math.abs(entryPrice - stopLoss) * (capital / entryPrice));
}

function getTradeLabel(trade) {
  return String(trade?.tradeName || trade?.marketType || trade?.strategy || trade?.id || 'Unlabeled trade').trim();
}

function getRiskAnalytics(trades) {
  const riskRows = trades.map((trade) => ({
    label: getTradeLabel(trade),
    riskAmount: getTradeRiskAmount(trade),
    capital: toNumber(trade?.capital ?? trade?.riskData?.capital),
    riskRewardRatio: toNumber(trade?.riskRewardRatio ?? trade?.riskData?.riskRewardRatio),
    tradeResult: trade?.tradeResult || trade?.performanceData?.tradeResult || 'Open'
  })).filter((row) => row.riskAmount > 0);

  const totalRisk = riskRows.reduce((sum, row) => sum + row.riskAmount, 0);
  const averageRiskPerTrade = riskRows.length ? roundTo(totalRisk / riskRows.length) : 0;
  const highestRiskTrade = [...riskRows].sort((a, b) => b.riskAmount - a.riskAmount)[0] || null;
  const lowestRiskTrade = [...riskRows].sort((a, b) => a.riskAmount - b.riskAmount)[0] || null;
  const averageRiskPercent = riskRows.length ? roundTo(riskRows.reduce((sum, row) => sum + (row.capital ? (row.riskAmount / row.capital) * 100 : 0), 0) / riskRows.length) : 0;
  const positiveRiskRewardRatios = riskRows.map((row) => row.riskRewardRatio).filter((ratio) => ratio > 0);
  const averageRiskRewardRatio = positiveRiskRewardRatios.length ? roundTo(positiveRiskRewardRatios.reduce((sum, ratio) => sum + ratio, 0) / positiveRiskRewardRatios.length) : 0;
  const highRiskSignals = [averageRiskPercent > 3, averageRiskRewardRatio > 0 && averageRiskRewardRatio < 1, highestRiskTrade?.capital && (highestRiskTrade.riskAmount / highestRiskTrade.capital) * 100 > 5].filter(Boolean).length;
  const mediumRiskSignals = [averageRiskPercent > 1.5, averageRiskRewardRatio > 0 && averageRiskRewardRatio < 1.5].filter(Boolean).length;
  const riskScore = highRiskSignals >= 2 || averageRiskPercent > 5 ? 'High Risk' : highRiskSignals || mediumRiskSignals ? 'Medium Risk' : 'Low Risk';

  return {
    schemaVersion: 'tradoctory.risk-analytics.v1',
    riskDefinedTrades: riskRows.length,
    averageRiskPerTrade,
    highestRiskTrade,
    lowestRiskTrade,
    averageRiskRewardRatio,
    averageRiskPercent,
    riskScore,
    aiFeatureVector: {
      averageRiskPerTrade,
      highestRiskAmount: highestRiskTrade?.riskAmount || 0,
      lowestRiskAmount: lowestRiskTrade?.riskAmount || 0,
      averageRiskRewardRatio,
      averageRiskPercent,
      riskScore
    }
  };
}

export function generateTradeAnalytics(trades = []) {
  const validTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const strategyRanking = getStrategyRanking(validTrades);
  const consistency = analyzeConsistency(validTrades);
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
    riskAnalytics: getRiskAnalytics(validTrades),
    mostProfitableDay: getMostProfitableDay(validTrades),
    mostCommonEmotion: getMostCommon(emotions),
    consistencyScore: consistency.score,
    consistencyTrend: consistency.trend,
    consistencyFactors: consistency.factors,
    consistencySuggestions: consistency.suggestions,
    strategyRanking,
    featureReadiness: {
      aiCoach: true,
      traderPersonalityDetection: true,
      weeklyReports: true,
      performanceInsights: true,
      riskAnalytics: true,
      machineLearningReady: true
    }
  };
}
