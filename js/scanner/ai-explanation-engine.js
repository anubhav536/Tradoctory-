'use strict';

/* ===================================================
   TRADOCTORY — AI EXPLANATION ENGINE
   Generates human-readable analysis for every scored
   setup: Why Selected, Why Strong, Risk Factors,
   Invalidation Conditions, Market Context.
   =================================================== */

function pct(v) { return `${Number(v || 0).toFixed(2)}%`; }
function px(v)  { return Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }); }

function getTopFactors(factors, weights) {
  return Object.entries(factors)
    .map(([key, score]) => ({ key, score, weight: weights[key] || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(f => formatFactorName(f.key));
}

function getWeakFactors(factors) {
  return Object.entries(factors)
    .filter(([, v]) => v < 45)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([k]) => formatFactorName(k));
}

function formatFactorName(key) {
  const MAP = {
    trend:            'Trend Direction',
    volume:           'Volume Confirmation',
    momentum:         'Price Momentum',
    breakout:         'Breakout Structure',
    relativeStrength: 'Relative Strength',
    riskReward:       'Risk-Reward Ratio',
    marketAlignment:  'Market Alignment',
    sectorStrength:   'Sector Strength',
    mtfAlignment:     'Multi-Timeframe Confluence',
  };
  return MAP[key] || key;
}

function buildWhySelected(scored, regime) {
  const { symbol, name, direction, score, tier, factors, rrRatio } = scored;
  const displayName = name || symbol;
  const reasons = [];

  if (score >= 9.0) {
    reasons.push(`${displayName} achieved an S-Tier score of ${score}/10 — placing it in the top category of all scanned assets.`);
  } else if (score >= 8.0) {
    reasons.push(`${displayName} scored ${score}/10 (A-Tier), indicating a high-quality setup with strong confluence across multiple factors.`);
  } else {
    reasons.push(`${displayName} scored ${score}/10 (B-Tier), meeting the minimum threshold for a tradeable setup.`);
  }

  if (factors.trend >= 70) reasons.push(`The trend factor is strong (${Math.round(factors.trend)}/100) — price is positioned well relative to key intraday references.`);
  if (factors.volume >= 65) reasons.push(`Volume is above average, confirming active participation behind this move.`);
  if (factors.mtfAlignment >= 65) reasons.push(`Multiple timeframes are in agreement, providing higher-probability confluence.`);
  if (regime?.mood === 'Bullish' && direction === 'Bullish') reasons.push(`The ${direction} setup aligns with the broader market mood (${regime.mood}), adding tailwind.`);
  if (regime?.mood === 'Bearish' && direction === 'Bearish') reasons.push(`The ${direction} setup aligns with the current market regime (${regime.mood}).`);
  if (rrRatio >= 2) reasons.push(`Risk-reward ratio of 1:${rrRatio} exceeds the minimum 1:2 threshold required for alert generation.`);

  return reasons;
}

function buildWhyStrong(scored) {
  const { factors, score, direction, entry, stopLoss, target1, target2 } = scored;
  const reasons = [];
  const WEIGHTS = { trend: 0.20, volume: 0.10, momentum: 0.10, breakout: 0.15, relativeStrength: 0.10, riskReward: 0.10, marketAlignment: 0.10, sectorStrength: 0.05, mtfAlignment: 0.10 };

  const topFactors = getTopFactors(factors, WEIGHTS);
  if (topFactors.length) reasons.push(`Top contributing factors: ${topFactors.join(', ')}.`);

  if (factors.breakout >= 75) reasons.push(`Price is trading in the upper range quartile — a structurally bullish breakout zone.`);
  if (factors.relativeStrength >= 70) reasons.push(`Asset is showing relative outperformance compared to the benchmark.`);
  if (factors.momentum >= 70) reasons.push(`Recent candle momentum shows consistent directional pressure over the last 6 bars.`);
  if (factors.sectorStrength >= 70) reasons.push(`The sector is currently ranking in the top tier — sector tailwind is present.`);

  reasons.push(`Setup structure: Entry ${px(entry)} → Stop ${px(stopLoss)} → T1 ${px(target1)} → T2 ${px(target2)} (${direction}).`);

  return reasons;
}

function buildRiskFactors(scored, mtfAnalysis) {
  const { factors, score, direction } = scored;
  const risks = [];

  if (factors.volume < 50) risks.push('Volume is below average — move may lack institutional backing.');
  if (factors.mtfAlignment < 55) risks.push('Multi-timeframe alignment is weak — consider waiting for higher-TF confirmation.');
  if (mtfAnalysis?.majorConflict) risks.push(`Higher timeframe conflict detected: ${mtfAnalysis.summary}.`);
  if (factors.riskReward < 50) risks.push('Risk-reward structure is below optimal — size accordingly.');
  if (score < 8.5) risks.push('Setup does not qualify for a Telegram alert (requires score ≥ 9.0 with all gates confirmed).');
  if (factors.marketAlignment < 50) risks.push('Asset is not fully aligned with the current market regime — risk is elevated.');

  if (!risks.length) risks.push('No major risk factors identified — standard risk management applies.');

  return risks;
}

function buildInvalidationConditions(scored) {
  const { direction, stopLoss, entry, symbol } = scored;
  const conditions = [];

  if (direction === 'Bullish') {
    conditions.push(`${symbol} closes below stop loss at ${px(stopLoss)} — long thesis is invalidated.`);
    conditions.push(`Two consecutive candle closes below the entry zone reverse the setup bias.`);
    conditions.push(`Sudden spike in sell-side volume without price recovery.`);
  } else {
    conditions.push(`${symbol} closes above stop loss at ${px(stopLoss)} — short thesis is invalidated.`);
    conditions.push(`Two consecutive candle closes above the entry zone reverse the setup bias.`);
    conditions.push(`Strong buying volume surge with price reclaiming key levels.`);
  }

  conditions.push(`Any major macro event or news release can override technical signals — check economic calendar.`);

  return conditions;
}

function buildMarketContext(scored, regime, sectorRanking) {
  const lines = [];
  if (regime) {
    lines.push(`Market is currently in a ${regime.label} regime (${regime.mood}). ${regime.description}`);
    lines.push(`Trading bias: ${regime.tradingBias}`);
  }
  if (sectorRanking?.strongest) {
    lines.push(`Strongest sector: ${sectorRanking.strongest.icon} ${sectorRanking.strongest.label} (${sectorRanking.strongest.score}/100).`);
  }
  if (sectorRanking?.weakest) {
    lines.push(`Weakest sector: ${sectorRanking.weakest.icon} ${sectorRanking.weakest.label} (${sectorRanking.weakest.score}/100) — avoid.`);
  }
  if (scored.sector) {
    const sectorEntry = sectorRanking?.ranked?.find(s => s.key === scored.sector);
    if (sectorEntry) lines.push(`${scored.name || scored.symbol} sector (${sectorEntry.label}): ${sectorEntry.strength} — score ${sectorEntry.score}/100.`);
  }
  return lines;
}

/**
 * Generate a full AI explanation object for a scored setup.
 * @param {object} scored        - Output of scoreSetup()
 * @param {object} options
 * @param {object} options.regime         - detectMarketRegime() output
 * @param {object} options.sectorRanking  - rankSectors() output
 * @param {object} options.mtfAnalysis    - analyseMultiTimeframe() output
 * @returns {object}
 */
export function explainSetup(scored, options = {}) {
  const { regime = null, sectorRanking = null, mtfAnalysis = null } = options;
  const WEIGHTS = { trend: 0.20, volume: 0.10, momentum: 0.10, breakout: 0.15, relativeStrength: 0.10, riskReward: 0.10, marketAlignment: 0.10, sectorStrength: 0.05, mtfAlignment: 0.10 };

  return {
    whySelected:           buildWhySelected(scored, regime),
    whyStrong:             buildWhyStrong(scored),
    riskFactors:           buildRiskFactors(scored, mtfAnalysis),
    invalidationConditions:buildInvalidationConditions(scored),
    marketContext:         buildMarketContext(scored, regime, sectorRanking),
    weakFactors:           getWeakFactors(scored.factors || {}),
    disclaimer:            'This is an educational analysis only and does not constitute financial advice. Always use proper risk management.',
    generatedAt:           new Date().toISOString(),
  };
}

/**
 * Generate a short one-line summary for a scored setup (used in tables/lists).
 */
export function getSetupSummary(scored) {
  const { direction, score, tierLabel, rrRatio } = scored;
  return `${direction} setup · Score ${score}/10 · ${tierLabel} · R:R 1:${rrRatio}`;
}
