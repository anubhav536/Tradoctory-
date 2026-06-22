'use strict';

import { isClosedTrade, toNumber } from './trade.js';

export const ACHIEVEMENT_SCHEMA_VERSION = 'tradoctory.achievements.v1';

const DISCIPLINED_EMOTIONS = new Set(['calm', 'confident', 'focused', 'patient', 'neutral']);

function parseTradeTime(trade) {
  const rawDate = trade?.tradeDate || trade?.createdAt;
  const date = new Date(String(rawDate || '').includes('T') ? rawDate : `${rawDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getClosedTrades(trades) {
  return trades.filter(isClosedTrade).sort((a, b) => parseTradeTime(a) - parseTradeTime(b));
}

function calculateWinRate(trades) {
  if (!trades.length) return 0;
  const wins = trades.filter((trade) => String(trade.tradeResult).toLowerCase() === 'win').length;
  return Math.round((wins / trades.length) * 1000) / 10;
}

function getLongestWinningStreak(closedTrades) {
  return closedTrades.reduce((state, trade) => {
    const isWin = String(trade.tradeResult).toLowerCase() === 'win';
    const current = isWin ? state.current + 1 : 0;
    return { current, longest: Math.max(state.longest, current) };
  }, { current: 0, longest: 0 }).longest;
}

function getWinRateImprovement(closedTrades) {
  if (closedTrades.length < 10) return 0;
  const midpoint = Math.floor(closedTrades.length / 2);
  const baseline = calculateWinRate(closedTrades.slice(0, midpoint));
  const recent = calculateWinRate(closedTrades.slice(midpoint));
  return Math.round((recent - baseline) * 10) / 10;
}

function hasCompletePlan(trade) {
  return Boolean(String(trade?.strategy || '').trim())
    && toNumber(trade?.stopLoss) > 0
    && toNumber(trade?.target) > 0
    && toNumber(trade?.riskRewardRatio) >= 1;
}

function getDisciplinedTradeCount(closedTrades) {
  return closedTrades.filter((trade) => {
    const emotion = String(trade?.emotion || '').trim().toLowerCase();
    const hasReflection = Boolean(String(trade?.notes || '').trim()) || (Array.isArray(trade?.tags) && trade.tags.length > 0);
    const emotionIsDisciplined = !emotion || DISCIPLINED_EMOTIONS.has(emotion);
    return hasCompletePlan(trade) && hasReflection && emotionIsDisciplined;
  }).length;
}

function createAchievement({ id, title, description, icon, progress, target, unlockedDescription }) {
  const safeTarget = Math.max(target, 1);
  const safeProgress = Math.max(progress, 0);
  const unlocked = safeProgress >= safeTarget;
  return {
    id,
    title,
    description: unlocked ? unlockedDescription || description : description,
    icon,
    progress: Math.min(safeProgress, safeTarget),
    target: safeTarget,
    percent: Math.min(Math.round((safeProgress / safeTarget) * 100), 100),
    unlocked
  };
}

export function buildTradingAchievements(trades = []) {
  const validTrades = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const closedTrades = getClosedTrades(validTrades);
  const totalTrades = validTrades.length;
  const closedCount = closedTrades.length;
  const longestWinningStreak = getLongestWinningStreak(closedTrades);
  const winRateImprovement = getWinRateImprovement(closedTrades);
  const disciplinedTradeCount = getDisciplinedTradeCount(closedTrades);

  const achievements = [
    createAchievement({
      id: 'first-trade',
      title: 'First Trade',
      description: 'Log your first trade to start building an evidence-based journal.',
      unlockedDescription: 'First trade logged. Keep reviewing the process, not just the outcome.',
      icon: '🌱',
      progress: totalTrades,
      target: 1
    }),
    createAchievement({
      id: 'ten-trades-completed',
      title: '10 Trades Completed',
      description: 'Complete 10 closed trades to create an early learning sample.',
      icon: '📘',
      progress: closedCount,
      target: 10
    }),
    createAchievement({
      id: 'hundred-trades-completed',
      title: '100 Trades Completed',
      description: 'Complete 100 closed trades for a deeper review dataset.',
      icon: '🧠',
      progress: closedCount,
      target: 100
    }),
    createAchievement({
      id: 'five-wins-row',
      title: '5 Winning Trades In A Row',
      description: 'Build a 5-trade winning streak while staying risk aware.',
      icon: '🔥',
      progress: longestWinningStreak,
      target: 5
    }),
    createAchievement({
      id: 'win-rate-improvement',
      title: '10% Win Rate Improvement',
      description: 'Improve your recent win rate by 10 percentage points versus your baseline.',
      icon: '📈',
      progress: Math.max(winRateImprovement, 0),
      target: 10,
      unlockedDescription: `Win rate improved by ${winRateImprovement}% versus your baseline.`
    }),
    createAchievement({
      id: 'disciplined-trader',
      title: 'Disciplined Trader',
      description: 'Close 10 trades with a strategy, stop loss, target, reflection, and calm execution.',
      icon: '🛡️',
      progress: disciplinedTradeCount,
      target: 10
    })
  ];

  return {
    schemaVersion: ACHIEVEMENT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    summary: {
      unlockedCount: achievements.filter((achievement) => achievement.unlocked).length,
      totalCount: achievements.length,
      closedTrades: closedCount,
      longestWinningStreak,
      winRateImprovement,
      disciplinedTradeCount
    },
    achievements
  };
}
