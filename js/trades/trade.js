'use strict';

export const TRADE_SCHEMA_VERSION = 'tradoctory.trade.v1';

export const TRADE_TAGS = Object.freeze([
  '#Breakout',
  '#Scalp',
  '#Swing',
  '#NewsTrade',
  '#HighRisk',
  '#LowRisk'
]);

export const AI_LEARNING_SCHEMA_VERSION = 'tradoctory.ai-learning.v1';

const BUY_DIRECTIONS = new Set(['buy', 'long']);
const SELL_DIRECTIONS = new Set(['sell', 'short']);
const CLOSED_RESULTS = new Set(['Win', 'Loss', 'Breakeven']);

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundTo(value, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `trade_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeDirection(direction) {
  const value = String(direction || '').trim();
  const lowerValue = value.toLowerCase();

  if (BUY_DIRECTIONS.has(lowerValue)) return 'Buy';
  if (SELL_DIRECTIONS.has(lowerValue)) return 'Sell';
  return value || 'Buy';
}

export function normalizeTradeTags(tags = []) {
  const rawTags = Array.isArray(tags) ? tags : [tags];
  const allowedTagsByKey = new Map(TRADE_TAGS.map((tag) => [tag.toLowerCase(), tag]));

  return [...new Set(rawTags
    .map((tag) => String(tag || '').trim())
    .map((tag) => (tag && !tag.startsWith('#') ? `#${tag}` : tag))
    .map((tag) => allowedTagsByKey.get(tag.toLowerCase()))
    .filter(Boolean))];
}

function createAiLearningProfile({ tags, strategy, emotion, riskRewardRatio, tradeResult }) {
  return {
    schemaVersion: AI_LEARNING_SCHEMA_VERSION,
    tags,
    features: {
      strategy,
      emotion,
      riskRewardRatio,
      tradeResult
    },
    labels: [],
    notes: 'Reserved for future AI learning, clustering, and recommendation workflows.'
  };
}

export function calculateProfitLoss({ direction, capital, entryPrice, exitPrice }) {
  const normalizedDirection = normalizeDirection(direction);
  const capitalValue = toNumber(capital);
  const entry = toNumber(entryPrice);
  const exit = toNumber(exitPrice);

  if (!capitalValue || !entry || !exit) return 0;

  const positionSize = capitalValue / entry;
  const priceDifference = normalizedDirection === 'Sell' ? entry - exit : exit - entry;
  return roundTo(priceDifference * positionSize, 2);
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
  return roundTo(reward / risk, 2);
}

export function calculateTradeResult(profitLoss, exitPrice) {
  if (!toNumber(exitPrice)) return 'Open';
  if (profitLoss > 0) return 'Win';
  if (profitLoss < 0) return 'Loss';
  return 'Breakeven';
}

export function isClosedTrade(trade) {
  return CLOSED_RESULTS.has(trade?.tradeResult);
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
  const strategy = String(input.strategy || '').trim();
  const emotion = String(input.emotion || '').trim();
  const tradeResult = calculateTradeResult(profitLoss, exitPrice);
  const tags = normalizeTradeTags(input.tags);

  return {
    schemaVersion: TRADE_SCHEMA_VERSION,
    id: input.id || createId(),
    userId: input.userId || '',
    tradeName: String(input.tradeName || '').trim(),
    marketType: String(input.marketType || '').trim(),
    direction,
    strategy,
    capital,
    entryPrice,
    exitPrice,
    stopLoss,
    target,
    profitLoss,
    riskRewardRatio,
    tradeResult,
    tags,
    aiLearningProfile: createAiLearningProfile({ tags, strategy, emotion, riskRewardRatio, tradeResult }),
    emotion,
    notes: String(input.notes || '').trim(),
    screenshot: input.screenshot || '',
    tradeDate: input.tradeDate || now.slice(0, 10),
    createdAt: now
  };
}
