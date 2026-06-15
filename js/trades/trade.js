'use strict';

export const TRADE_SCHEMA_VERSION = 'tradoctory.trade.v1';

const BUY_DIRECTIONS = new Set(['buy', 'long']);
const SELL_DIRECTIONS = new Set(['sell', 'short']);

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeDirection(direction) {
  const value = String(direction || '').trim();
  const lowerValue = value.toLowerCase();

  if (BUY_DIRECTIONS.has(lowerValue)) return 'Buy';
  if (SELL_DIRECTIONS.has(lowerValue)) return 'Sell';
  return value || 'Buy';
}

export function calculateProfitLoss({ direction, capital, entryPrice, exitPrice }) {
  const normalizedDirection = normalizeDirection(direction);
  const capitalValue = toNumber(capital);
  const entry = toNumber(entryPrice);
  const exit = toNumber(exitPrice);

  if (!capitalValue || !entry || !exit) return 0;

  const positionSize = capitalValue / entry;
  const priceDifference = normalizedDirection === 'Sell' ? entry - exit : exit - entry;
  return roundMoney(priceDifference * positionSize);
}

export function calculateRiskRewardRatio({ direction, entryPrice, stopLoss, target }) {
  const normalizedDirection = normalizeDirection(direction);
  const entry = toNumber(entryPrice);
  const stop = toNumber(stopLoss);
  const targetPrice = toNumber(target);

  if (!entry || !stop || !targetPrice) return 0;

  const risk = normalizedDirection === 'Sell' ? stop - entry : entry - stop;
  const reward = normalizedDirection === 'Sell' ? entry - targetPrice : targetPrice - entry;

  if (risk <= 0 || reward <= 0) return 0;
  return Math.round((reward / risk + Number.EPSILON) * 100) / 100;
}

export function calculateTradeResult(profitLoss, exitPrice) {
  if (!toNumber(exitPrice)) return 'Open';
  if (profitLoss > 0) return 'Win';
  if (profitLoss < 0) return 'Loss';
  return 'Breakeven';
}

export function createTrade(input = {}) {
  const now = input.createdAt || new Date().toISOString();
  const direction = normalizeDirection(input.direction);
  const capital = toNumber(input.capital);
  const entryPrice = toNumber(input.entryPrice);
  const exitPrice = toNumber(input.exitPrice);
  const stopLoss = toNumber(input.stopLoss);
  const target = toNumber(input.target);
  const profitLoss = calculateProfitLoss({ direction, capital, entryPrice, exitPrice });
  const riskRewardRatio = calculateRiskRewardRatio({ direction, entryPrice, stopLoss, target });

  return {
    schemaVersion: TRADE_SCHEMA_VERSION,
    id: input.id || crypto.randomUUID(),
    userId: input.userId || '',
    tradeName: String(input.tradeName || '').trim(),
    marketType: String(input.marketType || '').trim(),
    direction,
    strategy: String(input.strategy || '').trim(),
    capital,
    entryPrice,
    exitPrice,
    stopLoss,
    target,
    profitLoss,
    riskRewardRatio,
    tradeResult: calculateTradeResult(profitLoss, exitPrice),
    emotion: String(input.emotion || '').trim(),
    notes: String(input.notes || '').trim(),
    screenshot: input.screenshot || '',
    tradeDate: input.tradeDate || now.slice(0, 10),
    createdAt: now
  };
}
