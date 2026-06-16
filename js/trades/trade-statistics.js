'use strict';

import { isClosedTrade, toNumber } from './trade.js';

const EMPTY_STATISTICS = Object.freeze({
  totalTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  winRate: 0,
  totalProfit: 0,
  averageProfit: 0,
  averageLoss: 0,
  bestTrade: 0,
  worstTrade: 0
});

function roundTo(value, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

/**
 * Calculates portfolio-level trading statistics from normalized trade records.
 * Keep this function pure so future repositories can replace localStorage with
 * server-side aggregation, caching, or streaming snapshots without UI changes.
 */
export function calculateTradeStatistics(trades = []) {
  if (!Array.isArray(trades) || trades.length === 0) return { ...EMPTY_STATISTICS };

  const totals = trades.reduce((summary, trade) => {
    const profitLoss = toNumber(trade?.profitLoss);
    const result = trade?.tradeResult;

    summary.totalTrades += 1;
    summary.totalProfit += profitLoss;
    summary.bestTrade = summary.totalTrades === 1 ? profitLoss : Math.max(summary.bestTrade, profitLoss);
    summary.worstTrade = summary.totalTrades === 1 ? profitLoss : Math.min(summary.worstTrade, profitLoss);

    if (isClosedTrade(trade)) summary.closedTrades += 1;

    if (result === 'Win') {
      summary.winningTrades += 1;
      summary.grossProfit += profitLoss;
    }

    if (result === 'Loss') {
      summary.losingTrades += 1;
      summary.grossLoss += profitLoss;
    }

    return summary;
  }, {
    ...EMPTY_STATISTICS,
    closedTrades: 0,
    grossProfit: 0,
    grossLoss: 0
  });

  return {
    totalTrades: totals.totalTrades,
    winningTrades: totals.winningTrades,
    losingTrades: totals.losingTrades,
    winRate: totals.closedTrades ? roundTo((totals.winningTrades / totals.closedTrades) * 100, 1) : 0,
    totalProfit: roundTo(totals.totalProfit),
    averageProfit: totals.winningTrades ? roundTo(totals.grossProfit / totals.winningTrades) : 0,
    averageLoss: totals.losingTrades ? roundTo(totals.grossLoss / totals.losingTrades) : 0,
    bestTrade: roundTo(totals.bestTrade),
    worstTrade: roundTo(totals.worstTrade)
  };
}
