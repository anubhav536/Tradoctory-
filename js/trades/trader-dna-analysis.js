'use strict';

import { isClosedTrade, toNumber } from './trade.js';

export const TRADER_DNA_SCHEMA_VERSION = 'tradoctory.trader-dna.v1';

const DEFAULT_RULES = Object.freeze({
  minSampleSize: 3,
  overtradeDailyLimit: 4,
  fomoRiskRewardThreshold: 1.5,
  conservativeRiskRewardThreshold: 2,
  riskHunterRiskRewardThreshold: 3,
  revengeLossStreak: 2,
  revengeWindowMinutes: 60,
  momentumStrategyKeywords: ['momentum', 'breakout', 'trend', 'trend-following', 'continuation']
});

const FOMO_EMOTIONS = new Set(['fomo', 'greedy', 'greed', 'excited', 'impulsive', 'euphoric']);
const CALM_EMOTIONS = new Set(['calm', 'confident', 'focused', 'patient', 'neutral', 'disciplined']);
const FEAR_EMOTIONS = new Set(['fear', 'fearful', 'anxious', 'anxiety', 'scared', 'panic', 'nervous', 'hesitant']);

function roundTo(value, precision = 1) {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function percent(part, whole) {
  return whole ? (part / whole) * 100 : 0;
}

function getEmotionKey(trade) {
  return String(trade?.emotion || trade?.emotionData?.emotion || '').trim().toLowerCase();
}

function getStrategyKey(trade) {
  return String(trade?.strategy || trade?.tradeData?.strategy || '').trim().toLowerCase();
}

function parseTimestamp(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getExecutionTimestamp(trade) {
  return parseTimestamp(trade?.executedAt || trade?.executionTime || trade?.entryTime || trade?.openedAt || trade?.tradeData?.executedAt || trade?.tradeData?.entryTime);
}

function getSortTimestamp(trade) {
  return getExecutionTimestamp(trade)
    || parseTimestamp(trade?.tradeDate ? `${trade.tradeDate}T00:00:00` : '')
    || parseTimestamp(trade?.createdAt || trade?.tradeData?.createdAt);
}

function getTradeDay(trade) {
  return String(trade?.tradeDate || trade?.tradeData?.tradeDate || trade?.createdAt?.slice(0, 10) || 'Unknown');
}

function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());
}

function hasTag(trade, tagName) {
  const target = tagName.toLowerCase();
  const tags = Array.isArray(trade?.tags) ? trade.tags : [];
  return tags.some((tag) => String(tag).toLowerCase() === target);
}

function getLossStreakCount(closedTrades) {
  const sortedTrades = [...closedTrades].sort((a, b) => getSortTimestamp(a) - getSortTimestamp(b));
  let current = 0;
  let max = 0;

  sortedTrades.forEach((trade) => {
    if (trade.tradeResult === 'Loss') {
      current += 1;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  });

  return max;
}

function getRevengeSequenceCount(trades, rules) {
  const sortedTrades = [...trades].sort((a, b) => getSortTimestamp(a) - getSortTimestamp(b));
  let lossStreak = [];
  let sequences = 0;

  sortedTrades.forEach((trade) => {
    if (trade.tradeResult === 'Loss') {
      lossStreak.push(trade);
      return;
    }

    if (lossStreak.length >= rules.revengeLossStreak) {
      const tradeTime = getExecutionTimestamp(trade);
      const previousLossTime = getExecutionTimestamp(lossStreak.at(-1));
      if (tradeTime && previousLossTime) {
        const minutesAfterLoss = (tradeTime - previousLossTime) / 60000;
        if (minutesAfterLoss >= 0 && minutesAfterLoss <= rules.revengeWindowMinutes) sequences += 1;
      }
    }

    lossStreak = [];
  });

  return sequences;
}

function getFeatureMetrics(trades, rules) {
  const validTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const closedTrades = validTrades.filter(isClosedTrade);
  const wins = closedTrades.filter((trade) => trade.tradeResult === 'Win').length;
  const losses = closedTrades.filter((trade) => trade.tradeResult === 'Loss').length;
  const byDay = groupBy(validTrades, getTradeDay);
  const overtradedDays = [...byDay.values()].filter((dayTrades) => dayTrades.length > rules.overtradeDailyLimit).length;
  const riskRewards = validTrades.map((trade) => toNumber(trade?.riskRewardRatio || trade?.riskData?.riskRewardRatio)).filter((ratio) => ratio > 0);
  const lowRiskRewardTrades = riskRewards.filter((ratio) => ratio < rules.fomoRiskRewardThreshold).length;
  const highRiskRewardTrades = riskRewards.filter((ratio) => ratio >= rules.riskHunterRiskRewardThreshold).length;
  const conservativeTrades = validTrades.filter((trade) => hasTag(trade, '#LowRisk') || toNumber(trade?.riskRewardRatio || trade?.riskData?.riskRewardRatio) >= rules.conservativeRiskRewardThreshold);
  const fomoTrades = validTrades.filter((trade) => FOMO_EMOTIONS.has(getEmotionKey(trade)) || (toNumber(trade?.riskRewardRatio || trade?.riskData?.riskRewardRatio) > 0 && toNumber(trade?.riskRewardRatio || trade?.riskData?.riskRewardRatio) < rules.fomoRiskRewardThreshold));
  const highRiskTrades = validTrades.filter((trade) => hasTag(trade, '#HighRisk') || toNumber(trade?.riskRewardRatio || trade?.riskData?.riskRewardRatio) >= rules.riskHunterRiskRewardThreshold);
  const calmTrades = validTrades.filter((trade) => CALM_EMOTIONS.has(getEmotionKey(trade)) || hasTag(trade, '#LowRisk'));
  const momentumTrades = validTrades.filter((trade) => {
    const strategy = getStrategyKey(trade);
    return hasTag(trade, '#Breakout') || rules.momentumStrategyKeywords.some((keyword) => strategy.includes(keyword));
  });

  return {
    totalTrades: validTrades.length,
    closedTrades: closedTrades.length,
    winRate: percent(wins, closedTrades.length),
    lossRate: percent(losses, closedTrades.length),
    profitableRate: percent(validTrades.filter((trade) => toNumber(trade?.profitLoss || trade?.performanceData?.profitLoss) > 0).length, validTrades.length),
    averageRiskReward: riskRewards.length ? riskRewards.reduce((sum, ratio) => sum + ratio, 0) / riskRewards.length : 0,
    lowRiskRewardRate: percent(lowRiskRewardTrades, riskRewards.length),
    highRiskRewardRate: percent(highRiskRewardTrades, riskRewards.length),
    fomoRate: percent(fomoTrades.length, validTrades.length),
    overtradeDayRate: percent(overtradedDays, byDay.size),
    revengeSequences: getRevengeSequenceCount(validTrades, rules),
    maxLossStreak: getLossStreakCount(closedTrades),
    conservativeRate: percent(conservativeTrades.length, validTrades.length),
    highRiskRate: percent(highRiskTrades.length, validTrades.length),
    calmRate: percent(calmTrades.length, validTrades.length),
    fearRate: percent(validTrades.filter((trade) => FEAR_EMOTIONS.has(getEmotionKey(trade))).length, validTrades.length),
    momentumRate: percent(momentumTrades.length, validTrades.length),
    sampleSizeReady: validTrades.length >= rules.minSampleSize
  };
}

function scorePersonalities(metrics) {
  return [
    { type: 'Disciplined Trader', score: (metrics.winRate * 0.35) + ((100 - metrics.fomoRate) * 0.2) + ((100 - metrics.overtradeDayRate) * 0.2) + (metrics.calmRate * 0.15) + (metrics.profitableRate * 0.1) },
    { type: 'FOMO Trader', score: (metrics.fomoRate * 0.45) + (metrics.lowRiskRewardRate * 0.3) + (metrics.overtradeDayRate * 0.15) + ((100 - metrics.winRate) * 0.1) },
    { type: 'Revenge Trader', score: clamp((metrics.revengeSequences * 30) + (metrics.maxLossStreak * 12) + (metrics.overtradeDayRate * 0.2) + (metrics.lossRate * 0.2)) },
    { type: 'Risk Hunter', score: (metrics.highRiskRate * 0.45) + (metrics.highRiskRewardRate * 0.25) + (metrics.averageRiskReward * 8) + (metrics.fomoRate * 0.1) },
    { type: 'Conservative Trader', score: (metrics.conservativeRate * 0.45) + ((100 - metrics.highRiskRate) * 0.2) + ((100 - metrics.fomoRate) * 0.15) + (metrics.calmRate * 0.1) + (metrics.winRate * 0.1) },
    { type: 'Momentum Trader', score: (metrics.momentumRate * 0.55) + (metrics.winRate * 0.2) + (metrics.averageRiskReward * 7) + (metrics.profitableRate * 0.1) },
    { type: 'Overtrader', score: (metrics.overtradeDayRate * 0.55) + (metrics.fomoRate * 0.2) + (metrics.totalTrades > 20 ? 10 : 0) + ((100 - metrics.winRate) * 0.15) }
  ].map((personality) => ({ ...personality, score: clamp(roundTo(personality.score)) }))
    .sort((a, b) => b.score - a.score);
}

function getStrengths(type, metrics) {
  const strengthsByType = {
    'Disciplined Trader': ['Shows patience and controlled execution.', 'Avoids obvious overtrading and emotional entry patterns.'],
    'FOMO Trader': ['Acts quickly when opportunities appear.', 'Comfortable participating in active markets.'],
    'Revenge Trader': ['Highly motivated to recover from setbacks.', 'Keeps engaging instead of freezing after losses.'],
    'Risk Hunter': ['Comfortable targeting larger reward profiles.', 'Willing to take asymmetric opportunities.'],
    'Conservative Trader': ['Prioritizes quality setups and risk awareness.', 'Shows restraint around high-risk behavior.'],
    'Momentum Trader': ['Finds continuation and breakout-style opportunities.', 'Can align trades with directional market pressure.'],
    Overtrader: ['Generates many data points for review.', 'Stays active and engaged with the market.']
  };

  const dynamic = [];
  if (metrics.winRate >= 55) dynamic.push(`${roundTo(metrics.winRate)}% win rate supports the current trading style.`);
  if (metrics.averageRiskReward >= 2) dynamic.push(`${roundTo(metrics.averageRiskReward, 2)}:1 average R:R shows favorable reward planning.`);
  return [...(strengthsByType[type] || []), ...dynamic].slice(0, 4);
}

function getWeaknesses(type, metrics) {
  const weaknessesByType = {
    'Disciplined Trader': ['May miss valid trades if rules become too restrictive.'],
    'FOMO Trader': ['Impulsive entries can lower setup quality.', 'Low R:R trades may cap long-term expectancy.'],
    'Revenge Trader': ['Loss streaks can trigger rushed follow-up trades.', 'Recovery mindset may override the trading plan.'],
    'Risk Hunter': ['Oversized risk can create volatile equity swings.', 'High reward targets may reduce realized win rate.'],
    'Conservative Trader': ['May under-participate in strong opportunities.', 'Fear-based hesitation can reduce execution quality.'],
    'Momentum Trader': ['Can suffer in choppy, range-bound conditions.', 'Late entries may become FOMO if confirmation is weak.'],
    Overtrader: ['High frequency can reduce decision quality.', 'Trading too many setups can dilute edge.']
  };

  const dynamic = [];
  if (metrics.overtradeDayRate > 0) dynamic.push(`${roundTo(metrics.overtradeDayRate)}% of active days exceeded the trade limit.`);
  if (metrics.fomoRate > 25) dynamic.push(`${roundTo(metrics.fomoRate)}% of trades show FOMO-style evidence.`);
  if (metrics.maxLossStreak >= 2) dynamic.push(`Maximum loss streak reached ${metrics.maxLossStreak} trades.`);
  return [...(weaknessesByType[type] || []), ...dynamic].slice(0, 4);
}

export function analyzeTraderDna(trades = [], options = {}) {
  const rules = { ...DEFAULT_RULES, ...options };
  const metrics = getFeatureMetrics(trades, rules);
  const rankedPersonalities = scorePersonalities(metrics);
  const top = rankedPersonalities[0] || { type: 'Disciplined Trader', score: 0 };
  const confidenceScore = metrics.sampleSizeReady ? Math.round(top.score) : Math.round(top.score * 0.6);

  return {
    schemaVersion: TRADER_DNA_SCHEMA_VERSION,
    engine: 'rule-based',
    aiUpgradeReady: true,
    generatedAt: new Date().toISOString(),
    traderType: metrics.totalTrades ? top.type : 'Not enough trade data',
    confidenceScore: metrics.totalTrades ? confidenceScore : 0,
    strengths: metrics.totalTrades ? getStrengths(top.type, metrics) : ['Start logging trades to build your Trader DNA profile.'],
    weaknesses: metrics.totalTrades ? getWeaknesses(top.type, metrics) : ['No behavior pattern can be classified until trades exist.'],
    rankedPersonalities,
    metrics,
    rules,
    futureAiContext: {
      featureSchema: TRADER_DNA_SCHEMA_VERSION,
      recommendedModelInput: ['trade result sequence', 'risk/reward profile', 'strategy labels', 'emotion tags', 'trade timing']
    }
  };
}
