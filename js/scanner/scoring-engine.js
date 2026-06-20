'use strict';

/* ===================================================
   TRADOCTORY — SCORING ENGINE  (scoring-engine.js)

   9-Factor weighted scoring system → 0-10 score
   Converts to Tier: S / A / B / Reject

   Weights:
   Trend                20%
   Volume               10%
   Momentum             10%
   Breakout             15%
   Relative Strength    10%
   Risk Reward          10%
   Market Alignment     10%
   Sector Strength       5%
   MTF Alignment        10%
   Total               100%
   =================================================== */

function clamp(v, min = 0, max = 100) { return Math.min(max, Math.max(min, v)); }

const WEIGHTS = Object.freeze({
  trend:           0.20,
  volume:          0.10,
  momentum:        0.10,
  breakout:        0.15,
  relativeStrength:0.10,
  riskReward:      0.10,
  marketAlignment: 0.10,
  sectorStrength:  0.05,
  mtfAlignment:    0.10,
});

const TIERS = Object.freeze([
  { tier: 'S', min: 9.0,  label: 'S-Tier', color: '#f59e0b', glow: 'rgba(245,158,11,0.35)', emoji: '🔥' },
  { tier: 'A', min: 8.0,  label: 'A-Tier', color: '#00d26a', glow: 'rgba(0,210,106,0.25)',  emoji: '✅' },
  { tier: 'B', min: 7.0,  label: 'B-Tier', color: '#3b82f6', glow: 'rgba(59,130,246,0.20)', emoji: '📊' },
  { tier: 'R', min: 0,    label: 'Reject',  color: '#6b7280', glow: 'none',                  emoji: '❌' },
]);

export function getTierForScore(score) {
  return TIERS.find(t => score >= t.min) || TIERS[TIERS.length - 1];
}

/**
 * Calculate the trend factor score (0-100).
 * Based on price vs open, vs previous close, and ADX proxy.
 */
function scoreTrend(snapshot) {
  const price = Number(snapshot.price || 0);
  const open  = Number(snapshot.open || price);
  const pc    = Number(snapshot.previousClose || price);
  const chPct = Number(snapshot.changePercent || 0);

  const aboveOpen = price >= open ? 30 : 0;
  const abovePC   = price >= pc   ? 25 : 0;
  const momentum  = clamp(Math.abs(chPct) * 12, 0, 35);
  const direction = chPct >= 0 ? momentum : -momentum;

  return clamp(aboveOpen + abovePC + 30 + direction * 0.3);
}

/**
 * Volume factor score (0-100).
 */
function scoreVolume(snapshot) {
  const candles = Array.isArray(snapshot.candles) ? snapshot.candles : [];
  const last = candles[candles.length - 1];
  const recent = Number(last?.volume || snapshot.volume || 0);
  const hist = candles.slice(-12).map(c => Number(c.volume || 0)).filter(Boolean);
  const avg  = hist.length ? hist.reduce((s, v) => s + v, 0) / hist.length : recent;
  const ratio = avg ? recent / avg : 1;
  return clamp(ratio * 50);
}

/**
 * Momentum factor score (0-100).
 */
function scoreMomentum(snapshot) {
  const candles = Array.isArray(snapshot.candles) ? snapshot.candles : [];
  if (candles.length < 6) return 50;
  const recent = candles.slice(-6);
  const first  = Number(recent[0]?.close || recent[0]?.open || 0);
  const last   = Number(recent[recent.length - 1]?.close || 0);
  const pct    = first ? ((last - first) / first) * 100 : 0;
  return clamp(50 + pct * 10);
}

/**
 * Breakout factor score (0-100).
 * High score = price near or above recent resistance.
 */
function scoreBreakout(snapshot) {
  const price = Number(snapshot.price || 0);
  const high  = Number(snapshot.high || price);
  const low   = Number(snapshot.low || price);
  const range = Math.max(high - low, 1);
  const pos   = ((price - low) / range) * 100;
  if (pos >= 85) return 90;
  if (pos >= 70) return 75;
  if (pos >= 50) return 55;
  if (pos >= 30) return 40;
  return 20;
}

/**
 * Relative strength score (0-100).
 * Approximated from change vs market baseline.
 */
function scoreRelativeStrength(snapshot, marketSnapshot = null) {
  const chPct = Number(snapshot.changePercent || 0);
  const mktChPct = marketSnapshot ? Number(marketSnapshot.changePercent || 0) : 0;
  const rs = chPct - mktChPct;
  return clamp(50 + rs * 8);
}

/**
 * Risk-Reward score (0-100).
 * Based on candle structure and range position.
 */
function scoreRiskReward(snapshot) {
  const price  = Number(snapshot.price || 0);
  const high   = Number(snapshot.high || price);
  const low    = Number(snapshot.low || price);
  const range  = Math.max(high - low, 1);
  const chPct  = Number(snapshot.changePercent || 0);

  const potentialReward = Math.abs(chPct) >= 0.5 ? 70 : 45;
  const stopDistance    = ((price - low) / range) * 100;
  const rrProxy         = stopDistance > 0 ? potentialReward / (stopDistance / 100 + 0.01) : 50;
  return clamp(rrProxy * 0.6 + 20);
}

/**
 * Market alignment score (0-100).
 * How well does this asset align with the overall market regime?
 */
function scoreMarketAlignment(snapshot, regime = null) {
  if (!regime) return 50;
  const chPct  = Number(snapshot.changePercent || 0);
  const isBull = chPct >= 0;
  if (regime.mood === 'Bullish' && isBull)  return 85;
  if (regime.mood === 'Bearish' && !isBull) return 85;
  if (regime.mood === 'Neutral')            return 55;
  if (regime.mood === 'High Risk')          return 30;
  return 40;
}

/**
 * Sector strength score (0-100).
 */
function scoreSectorStrength(snapshot, sectorRanking = null) {
  if (!sectorRanking || !snapshot.sector) return 50;
  const entry = sectorRanking.ranked?.find(s => s.key === snapshot.sector);
  return entry ? entry.score : 50;
}

/**
 * MTF alignment score — directly uses the mtfAnalysis object.
 */
function scoreMtfAlignment(mtfAnalysis = null) {
  if (!mtfAnalysis) return 50;
  return clamp(mtfAnalysis.alignmentScore - mtfAnalysis.penalty);
}

/**
 * Master scoring function.
 * @param {object} snapshot        - Market data snapshot
 * @param {object} options
 * @param {object} options.regime  - Output of detectMarketRegime()
 * @param {object} options.sectorRanking - Output of rankSectors()
 * @param {object} options.mtfAnalysis   - Output of analyseMultiTimeframe()
 * @param {object} options.marketSnapshot - Nifty reference snapshot
 * @returns {object} Detailed score breakdown + final score + tier
 */
export function scoreSetup(snapshot = {}, options = {}) {
  const { regime = null, sectorRanking = null, mtfAnalysis = null, marketSnapshot = null } = options;

  const factors = {
    trend:            scoreTrend(snapshot),
    volume:           scoreVolume(snapshot),
    momentum:         scoreMomentum(snapshot),
    breakout:         scoreBreakout(snapshot),
    relativeStrength: scoreRelativeStrength(snapshot, marketSnapshot),
    riskReward:       scoreRiskReward(snapshot),
    marketAlignment:  scoreMarketAlignment(snapshot, regime),
    sectorStrength:   scoreSectorStrength(snapshot, sectorRanking),
    mtfAlignment:     scoreMtfAlignment(mtfAnalysis),
  };

  const weightedTotal = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => {
    return sum + (factors[key] || 0) * weight;
  }, 0);

  const rawScore   = weightedTotal / 10;
  const finalScore = Math.round(clamp(rawScore, 0, 10) * 10) / 10;
  const tier       = getTierForScore(finalScore);

  const direction = Number(snapshot.changePercent || 0) >= 0 ? 'Bullish' : 'Bearish';
  const price     = Number(snapshot.price || 0);
  const high      = Number(snapshot.high || price);
  const low       = Number(snapshot.low || price);
  const range     = Math.max(high - low, 1);

  const entry   = price;
  const stopBull = Math.max(low - range * 0.05, price * 0.985);
  const stopBear = Math.min(high + range * 0.05, price * 1.015);
  const stop    = direction === 'Bullish' ? stopBull : stopBear;
  const risk    = Math.abs(price - stop);
  const t1      = direction === 'Bullish' ? price + risk * 1.5 : price - risk * 1.5;
  const t2      = direction === 'Bullish' ? price + risk * 2.5 : price - risk * 2.5;
  const rrRatio = risk > 0 ? (Math.abs(t1 - price) / risk) : 0;

  return {
    symbol:      snapshot.symbol || '',
    name:        snapshot.displayName || snapshot.symbol || '',
    sector:      snapshot.sector || null,
    direction,
    score:       finalScore,
    tier:        tier.tier,
    tierLabel:   tier.label,
    tierColor:   tier.color,
    tierGlow:    tier.glow,
    tierEmoji:   tier.emoji,
    factors,
    entry:       Math.round(entry * 100) / 100,
    stopLoss:    Math.round(stop * 100) / 100,
    target1:     Math.round(t1 * 100) / 100,
    target2:     Math.round(t2 * 100) / 100,
    rrRatio:     Math.round(rrRatio * 10) / 10,
    confidence:  Math.round(finalScore * 10),
    snapshot,
    generatedAt: new Date().toISOString(),
  };
}

export { WEIGHTS, TIERS };
