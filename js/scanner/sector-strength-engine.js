'use strict';

/* ===================================================
   TRADOCTORY — SECTOR STRENGTH ENGINE
   Ranks sectors by simulated relative strength.
   Uses deterministic math seeded by time so sectors
   shift gradually — visually realistic, never stale.
   =================================================== */

import { SECTOR_META } from './symbol-database.js';

function clamp(v, min = 0, max = 100) { return Math.min(max, Math.max(min, v)); }

function seedRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function getSectorStrengthScore(sectorKey, niftyChange = 0, now = new Date()) {
  const seed = Math.floor(now.getTime() / (10 * 60 * 1000));
  const rng = seedRandom(seed + sectorKey.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  const base = 45 + rng() * 30;
  const marketBias = niftyChange >= 0 ? 5 : -5;
  const noise = (rng() - 0.5) * 18;
  return clamp(base + marketBias + noise);
}

function getSectorLabel(score) {
  if (score >= 72) return 'Strong';
  if (score >= 55) return 'Moderate';
  if (score >= 40) return 'Weak';
  return 'Very Weak';
}

function getSectorColor(score) {
  if (score >= 72) return '#00d26a';
  if (score >= 55) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

/**
 * Rank all sectors by strength score.
 * @param {object} niftySnapshot - snapshot from MarketDataProvider (for market bias)
 * @returns {{ ranked: Array, strongest: object, weakest: object, timestamp: string }}
 */
export function rankSectors(niftySnapshot = {}) {
  const niftyChange = Number(niftySnapshot.changePercent || 0);
  const now = new Date();

  const ranked = SECTOR_META.map(sector => {
    const score = getSectorStrengthScore(sector.key, niftyChange, now);
    return {
      key:        sector.key,
      label:      sector.label,
      icon:       sector.icon,
      score:      Math.round(score),
      strength:   getSectorLabel(score),
      color:      getSectorColor(score),
      stockCount: sector.stocks.length,
    };
  }).sort((a, b) => b.score - a.score);

  return {
    ranked,
    strongest:   ranked[0] || null,
    weakest:     ranked[ranked.length - 1] || null,
    leaderboard: ranked.slice(0, 5),
    timestamp:   now.toISOString(),
  };
}
