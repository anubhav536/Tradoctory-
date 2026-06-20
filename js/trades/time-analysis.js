'use strict';

import { toNumber } from './trade.js';

export const TIME_ANALYSIS_SCHEMA_VERSION = 'tradoctory.time-analysis.v1';

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
  return parseTimestamp(
    trade?.executedAt
      || trade?.executionTime
      || trade?.entryTime
      || trade?.openedAt
      || trade?.tradeData?.executedAt
      || trade?.tradeData?.executionTime
      || trade?.tradeData?.entryTime
      || trade?.tradeData?.openedAt
      || trade?.createdAt
      || trade?.tradeData?.createdAt
  );
}

function getTradeDate(trade) {
  return String(trade?.tradeDate || trade?.tradeData?.tradeDate || trade?.createdAt?.slice(0, 10) || trade?.tradeData?.createdAt?.slice(0, 10) || '').trim();
}

function getDateFromTrade(trade) {
  const timestamp = getExecutionTimestamp(trade);
  if (timestamp) return new Date(timestamp);

  const tradeDate = getTradeDate(trade);
  if (!tradeDate) return null;

  const date = new Date(`${tradeDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getWeekdayName(date) {
  return date ? WEEKDAYS[date.getDay()] : 'Unknown';
}

function formatHour(hour) {
  const normalizedHour = ((hour % 24) + 24) % 24;
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
  const displayHour = normalizedHour % 12 || 12;
  return `${displayHour}:00 ${suffix}`;
}

function formatHourWindow(hour) {
  return `${formatHour(hour)}–${formatHour(hour + 1)}`;
}

function summarizeGroup(label, items) {
  const trades = items.map((item) => item?.trade || item);
  const totalProfit = trades.reduce((sum, trade) => sum + toNumber(trade?.profitLoss ?? trade?.performanceData?.profitLoss), 0);
  const wins = trades.filter((trade) => (trade?.tradeResult || trade?.performanceData?.tradeResult) === 'Win').length;

  return {
    label,
    trades: trades.length,
    wins,
    totalProfit: roundTo(totalProfit),
    averageProfit: trades.length ? roundTo(totalProfit / trades.length) : 0,
    winRate: trades.length ? roundTo((wins / trades.length) * 100, 1) : 0
  };
}

function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    if (key === null || key === undefined || key === '') return groups;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());
}

function rankGroups(groups, decorate) {
  return [...groups.entries()]
    .map(([label, trades]) => ({ ...decorate(label, trades), ...summarizeGroup(label, trades) }))
    .sort((a, b) => b.totalProfit - a.totalProfit || b.winRate - a.winRate || b.trades - a.trades || String(a.label).localeCompare(String(b.label)));
}

function buildRecommendations({ hourlyRanking, weekdayRanking, dayRanking, tradesWithTime, sampleSize }) {
  const recommendations = [];
  const bestHour = hourlyRanking[0];
  const worstHour = [...hourlyRanking].sort((a, b) => a.totalProfit - b.totalProfit || a.winRate - b.winRate || b.trades - a.trades)[0];
  const bestWeekday = weekdayRanking[0];
  const worstDay = [...dayRanking].sort((a, b) => a.totalProfit - b.totalProfit || a.winRate - b.winRate || b.trades - a.trades)[0];

  if (!sampleSize) return ['Add historical trades with timestamps to unlock time-based trading recommendations.'];
  if (!tradesWithTime) recommendations.push('Add entry or execution timestamps to each trade so hourly profitability can be measured.');
  if (bestHour?.trades) recommendations.push(`Your highest profitability occurs between ${bestHour.windowLabel}. Prioritize your best setups during that window.`);
  if (worstHour?.trades && worstHour.totalProfit < 0) recommendations.push(`Avoid or reduce trading between ${worstHour.windowLabel} until your playbook shows a positive edge there.`);
  if (bestWeekday?.trades) recommendations.push(`${bestWeekday.label} is your strongest trading day. Review what market conditions and strategies repeat on that day.`);
  if (worstDay?.trades && worstDay.totalProfit < 0) recommendations.push(`Your worst trading day was ${worstDay.label}. Study those trades before taking similar setups again.`);
  if (!recommendations.length) recommendations.push('Keep logging timestamps so the time analysis engine can identify stronger hourly and daily patterns.');
  return recommendations;
}

export function analyzeTradeTime(trades = []) {
  const validTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const enrichedTrades = validTrades.map((trade) => ({ trade, date: getDateFromTrade(trade), tradeDate: getTradeDate(trade) }));
  const tradesWithTime = enrichedTrades.filter((item) => item.date && getExecutionTimestamp(item.trade));
  const tradesWithDate = enrichedTrades.filter((item) => item.date || item.tradeDate);

  const hourlyRanking = rankGroups(groupBy(tradesWithTime, (item) => item.date.getHours()), (hour) => ({
    hour: Number(hour),
    windowLabel: formatHourWindow(Number(hour))
  }));

  const weekdayRanking = rankGroups(groupBy(tradesWithDate, (item) => getWeekdayName(item.date)), (weekday) => ({ weekday }));

  const dayRanking = rankGroups(groupBy(tradesWithDate, (item) => item.tradeDate || item.date.toISOString().slice(0, 10)), (date, items) => ({
    date,
    weekday: getWeekdayName(items[0]?.date)
  }));

  const worstHour = [...hourlyRanking].sort((a, b) => a.totalProfit - b.totalProfit || a.winRate - b.winRate || b.trades - a.trades)[0] || null;
  const worstTradingDay = [...dayRanking].sort((a, b) => a.totalProfit - b.totalProfit || a.winRate - b.winRate || b.trades - a.trades)[0] || null;

  const analytics = {
    schemaVersion: TIME_ANALYSIS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sampleSize: validTrades.length,
    timestampedTrades: tradesWithTime.length,
    datedTrades: tradesWithDate.length,
    mostProfitableHour: hourlyRanking[0] || null,
    leastProfitableHour: worstHour,
    mostProfitableDay: weekdayRanking[0] || null,
    worstTradingDay,
    hourlyRanking,
    weekdayRanking,
    dayRanking
  };

  return {
    ...analytics,
    recommendations: buildRecommendations({ ...analytics, tradesWithTime: tradesWithTime.length })
  };
}
