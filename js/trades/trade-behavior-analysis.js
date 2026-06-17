'use strict';

import { isClosedTrade, toNumber } from './trade.js';

const DEFAULT_RULES = Object.freeze({
  overtradeDailyLimit: 4,
  revengeLossStreak: 2,
  revengeWindowMinutes: 60,
  idealRiskReward: 2,
  fomoRiskRewardThreshold: 1.5,
  minSampleSize: 2
});

const FEAR_EMOTIONS = new Set(['fear', 'fearful', 'anxious', 'anxiety', 'scared', 'panic', 'nervous', 'hesitant']);
const FOMO_EMOTIONS = new Set(['fomo', 'greedy', 'greed', 'excited', 'impulsive', 'euphoric']);
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function roundTo(value, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function parseTimestamp(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getExecutionTimestamp(trade) {
  const explicitExecutionTime = trade?.executedAt || trade?.executionTime || trade?.entryTime || trade?.openedAt;
  return parseTimestamp(explicitExecutionTime);
}

function getSortTimestamp(trade) {
  return getExecutionTimestamp(trade)
    || parseTimestamp(trade?.tradeDate ? `${trade.tradeDate}T00:00:00` : '')
    || parseTimestamp(trade?.createdAt);
}

function getTradeDay(trade) {
  return String(trade?.tradeDate || trade?.createdAt?.slice(0, 10) || 'Unknown');
}

function getWeekdayName(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Unknown' : WEEKDAYS[date.getUTCDay()];
}

function getEmotionKey(trade) {
  return String(trade?.emotion || '').trim().toLowerCase();
}

function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());
}

function summarizeTrades(items) {
  const closedTrades = items.filter(isClosedTrade);
  const wins = closedTrades.filter((trade) => trade.tradeResult === 'Win').length;
  const losses = closedTrades.filter((trade) => trade.tradeResult === 'Loss').length;
  const totalProfit = items.reduce((sum, trade) => sum + toNumber(trade?.profitLoss), 0);

  return {
    trades: items.length,
    closedTrades: closedTrades.length,
    wins,
    losses,
    winRate: closedTrades.length ? roundTo((wins / closedTrades.length) * 100, 1) : 0,
    totalProfit: roundTo(totalProfit),
    averageProfit: items.length ? roundTo(totalProfit / items.length) : 0
  };
}

function createObservation(type, severity, message, evidence = {}) {
  return { type, severity, message, evidence };
}

function analyzeOvertrading(trades, rules) {
  const byDay = groupBy(trades, getTradeDay);
  const overtradedDays = [...byDay.entries()]
    .filter(([, dayTrades]) => dayTrades.length > rules.overtradeDailyLimit)
    .map(([date, dayTrades]) => ({ date, weekday: getWeekdayName(date), ...summarizeTrades(dayTrades) }));

  const byWeekday = groupBy(overtradedDays, (day) => day.weekday);
  const topWeekday = [...byWeekday.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const observations = [];

  if (topWeekday && topWeekday[1].length >= rules.minSampleSize) {
    observations.push(createObservation(
      'overtrading',
      'warning',
      `You tend to overtrade on ${topWeekday[0]}s.`,
      { days: topWeekday[1].length, dailyLimit: rules.overtradeDailyLimit }
    ));
  } else if (overtradedDays.length) {
    observations.push(createObservation(
      'overtrading',
      'warning',
      `You exceeded ${rules.overtradeDailyLimit} trades on ${overtradedDays.length} day${overtradedDays.length === 1 ? '' : 's'}.`,
      { days: overtradedDays.length, dailyLimit: rules.overtradeDailyLimit }
    ));
  }

  return { overtradedDays, observations };
}

function analyzeRevengeTrading(trades, rules) {
  const sortedTrades = [...trades].sort((a, b) => getSortTimestamp(a) - getSortTimestamp(b));
  const sequences = [];
  let lossStreak = [];

  sortedTrades.forEach((trade) => {
    if (trade.tradeResult === 'Loss') {
      lossStreak.push(trade);
      return;
    }

    if (lossStreak.length >= rules.revengeLossStreak) {
      const previousLoss = lossStreak.at(-1);
      const tradeExecutionTimestamp = getExecutionTimestamp(trade);
      const previousLossExecutionTimestamp = getExecutionTimestamp(previousLoss);

      if (tradeExecutionTimestamp && previousLossExecutionTimestamp) {
        const minutesAfterLoss = (tradeExecutionTimestamp - previousLossExecutionTimestamp) / 60000;
        if (minutesAfterLoss >= 0 && minutesAfterLoss <= rules.revengeWindowMinutes) {
          sequences.push({ losses: [...lossStreak], nextTrade: trade, minutesAfterLoss: roundTo(minutesAfterLoss, 1) });
        }
      }
    }

    lossStreak = trade.tradeResult === 'Loss' ? [trade] : [];
  });

  const observations = sequences.length
    ? [createObservation('revenge-trading', 'danger', `Revenge trading risk: ${sequences.length} immediate trade${sequences.length === 1 ? '' : 's'} followed ${rules.revengeLossStreak}+ losses.`, { sequences: sequences.length })]
    : [];

  return { sequences, observations };
}

function analyzeFomoTrading(trades, rules) {
  const lowRiskRewardTrades = trades.filter((trade) => {
    const ratio = toNumber(trade?.riskRewardRatio);
    return ratio > 0 && ratio < rules.fomoRiskRewardThreshold;
  });
  const emotionDrivenTrades = trades.filter((trade) => FOMO_EMOTIONS.has(getEmotionKey(trade)));
  const fomoTrades = [...new Map([...lowRiskRewardTrades, ...emotionDrivenTrades].map((trade) => [trade.id || trade, trade])).values()];
  const observations = [];

  if (lowRiskRewardTrades.length) {
    observations.push(createObservation('fomo-trading', 'warning', `${lowRiskRewardTrades.length} trade${lowRiskRewardTrades.length === 1 ? ' was' : 's were'} entered below the ideal ${rules.idealRiskReward}:1 risk-reward profile.`, summarizeTrades(lowRiskRewardTrades)));
  }

  if (emotionDrivenTrades.length) {
    observations.push(createObservation('fomo-trading', 'warning', `${emotionDrivenTrades.length} trade${emotionDrivenTrades.length === 1 ? ' had' : 's had'} FOMO-like emotions logged; review whether the setup still matched your plan.`, summarizeTrades(emotionDrivenTrades)));
  }

  return { trades: fomoTrades, lowRiskRewardTrades, emotionDrivenTrades, summary: summarizeTrades(fomoTrades), observations };
}

function analyzeConsistency(trades, rules) {
  const byDay = groupBy(trades, getTradeDay);
  const days = [...byDay.entries()].map(([date, dayTrades]) => ({ date, weekday: getWeekdayName(date), ...summarizeTrades(dayTrades) }));
  const profitableDays = days.filter((day) => day.totalProfit > 0);
  const observations = [];

  if (days.length) {
    observations.push(createObservation('consistency', 'positive', `${profitableDays.length} of ${days.length} trading days were profitable.`, { profitableDays: profitableDays.length, totalDays: days.length }));
  }

  const byStrategy = groupBy(trades.filter((trade) => trade.strategy), (trade) => trade.strategy);
  const topStrategy = [...byStrategy.entries()]
    .map(([strategy, strategyTrades]) => ({ strategy, ...summarizeTrades(strategyTrades) }))
    .filter((strategy) => strategy.trades >= rules.minSampleSize)
    .sort((a, b) => b.totalProfit - a.totalProfit)[0];

  if (topStrategy) {
    observations.push(createObservation('strategy', 'positive', `Most profitable trades come from ${topStrategy.strategy} strategy.`, topStrategy));
  }

  const fearTrades = trades.filter((trade) => FEAR_EMOTIONS.has(getEmotionKey(trade)));
  const calmTrades = trades.filter((trade) => !FEAR_EMOTIONS.has(getEmotionKey(trade)) && isClosedTrade(trade));
  const fearSummary = summarizeTrades(fearTrades);
  const calmSummary = summarizeTrades(calmTrades);
  if (fearSummary.closedTrades >= rules.minSampleSize && calmSummary.closedTrades >= rules.minSampleSize && fearSummary.averageProfit < calmSummary.averageProfit) {
    observations.push(createObservation('emotion', 'warning', 'Fear based trades perform worse.', { fear: fearSummary, nonFear: calmSummary }));
  }

  return { days, profitableDays, observations };
}

export function analyzeTradeBehavior(trades = [], options = {}) {
  const rules = { ...DEFAULT_RULES, ...options };
  const validTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const overtrading = analyzeOvertrading(validTrades, rules);
  const revengeTrading = analyzeRevengeTrading(validTrades, rules);
  const fomoTrading = analyzeFomoTrading(validTrades, rules);
  const consistency = analyzeConsistency(validTrades, rules);
  const observations = [
    ...overtrading.observations,
    ...revengeTrading.observations,
    ...fomoTrading.observations,
    ...consistency.observations
  ];

  if (!observations.length) {
    observations.push(createObservation('baseline', 'positive', 'No major behavior risks detected yet. Keep logging trades to improve the analysis.', { trades: validTrades.length }));
  }

  return {
    generatedAt: new Date().toISOString(),
    rules,
    summary: summarizeTrades(validTrades),
    overtrading,
    revengeTrading,
    fomoTrading,
    consistency,
    observations
  };
}
