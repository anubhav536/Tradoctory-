'use strict';

export const TRADE_SCHEMA_VERSION = 'tradoctory.trade.v2';

export const TRADE_TAGS = Object.freeze([
  '#Breakout',
  '#Scalp',
  '#Swing',
  '#NewsTrade',
  '#HighRisk',
  '#LowRisk'
]);

export const AI_LEARNING_SCHEMA_VERSION = 'tradoctory.ai-learning.v2';

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

function createAiLearningProfile({ existingProfile = {}, tags, strategy, emotion, riskRewardRatio, tradeResult, tradeData, emotionData, riskData, performanceData }) {
  const existingFeatures = existingProfile?.features && typeof existingProfile.features === 'object'
    ? existingProfile.features
    : {};

  return {
    ...existingProfile,
    schemaVersion: AI_LEARNING_SCHEMA_VERSION,
    tags,
    features: {
      ...existingFeatures,
      strategy,
      emotion,
      riskRewardRatio,
      tradeResult,
      tradeData,
      emotionData,
      riskData,
      performanceData,
      mlFeatureVector: {
        strategy,
        emotion,
        direction: tradeData.direction,
        marketType: tradeData.marketType,
        capital: riskData.capital,
        riskRewardRatio: riskData.riskRewardRatio,
        profitLoss: performanceData.profitLoss,
        tradeResult: performanceData.tradeResult,
        tradeDate: tradeData.tradeDate
      }
    },
    labels: Array.isArray(existingProfile?.labels) ? [...existingProfile.labels] : [],
    notes: existingProfile?.notes || 'Reserved for future AI learning, clustering, and recommendation workflows.'
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
  const executionTimestamps = ['executedAt', 'executionTime', 'entryTime', 'openedAt'].reduce((timestamps, field) => {
    const timestamp = input[field] || input.tradeData?.[field];
    if (timestamp) timestamps[field] = timestamp;
    return timestamps;
  }, {});

  const id = input.id || createId();
  const userId = input.userId || '';
  const tradeDate = input.tradeDate || now.slice(0, 10);
  const notes = String(input.notes || '').trim();
  const screenshot = input.screenshot || '';
  const tradeData = {
    id,
    userId,
    tradeName: String(input.tradeName || '').trim(),
    marketType: String(input.marketType || '').trim(),
    direction,
    strategy,
    tags,
    tradeDate,
    createdAt: now,
    ...executionTimestamps
  };
  const emotionData = {
    emotion,
    notes,
    screenshot,
    tags,
    journaledAt: now
  };
  const riskData = {
    capital,
    entryPrice,
    exitPrice,
    stopLoss,
    target,
    riskRewardRatio,
    riskAmount: roundTo(Math.abs(entryPrice - stopLoss) * (entryPrice ? capital / entryPrice : 0)),
    rewardAmount: roundTo(Math.abs(target - entryPrice) * (entryPrice ? capital / entryPrice : 0))
  };
  const performanceData = {
    profitLoss,
    tradeResult,
    isClosed: CLOSED_RESULTS.has(tradeResult),
    returnPercent: capital ? roundTo((profitLoss / capital) * 100, 2) : 0
  };

  return {
    schemaVersion: TRADE_SCHEMA_VERSION,
    id,
    userId,
    tradeName: tradeData.tradeName,
    marketType: tradeData.marketType,
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
    tradeData,
    emotionData,
    riskData,
    performanceData,
    aiLearningProfile: createAiLearningProfile({
      existingProfile: input.aiLearningProfile,
      tags,
      strategy,
      emotion,
      riskRewardRatio,
      tradeResult,
      tradeData,
      emotionData,
      riskData,
      performanceData
    }),
    emotion,
    notes,
    screenshot,
    ...executionTimestamps,
    tradeDate,
    createdAt: now
  };
}
