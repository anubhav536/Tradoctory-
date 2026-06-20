'use strict';

/* ===================================================
   TRADOCTORY — MARKET REGIME ENGINE
   Detects: Trending | Range-Bound | Volatile |
            Expansion | Contraction
   Generates: Market Mood label + color + description
   =================================================== */

function clamp(v, min = 0, max = 100) { return Math.min(max, Math.max(min, v)); }
function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }

function calcAtr(candles) {
  if (!candles || candles.length < 2) return 0;
  const trs = candles.slice(-14).map((c, i, arr) => {
    if (i === 0) return Number(c.high) - Number(c.low);
    const prev = arr[i - 1];
    return Math.max(
      Number(c.high) - Number(c.low),
      Math.abs(Number(c.high) - Number(prev.close)),
      Math.abs(Number(c.low) - Number(prev.close))
    );
  });
  return avg(trs);
}

function calcAdx(candles) {
  if (!candles || candles.length < 14) return 25;
  const slice = candles.slice(-14);
  let dmPlus = 0; let dmMinus = 0; let trSum = 0;
  for (let i = 1; i < slice.length; i++) {
    const curr = slice[i]; const prev = slice[i - 1];
    const upMove = Number(curr.high) - Number(prev.high);
    const downMove = Number(prev.low) - Number(curr.low);
    if (upMove > downMove && upMove > 0) dmPlus += upMove;
    if (downMove > upMove && downMove > 0) dmMinus += downMove;
    trSum += Math.max(
      Number(curr.high) - Number(curr.low),
      Math.abs(Number(curr.high) - Number(prev.close)),
      Math.abs(Number(curr.low) - Number(prev.close))
    );
  }
  if (!trSum) return 25;
  const diPlus = (dmPlus / trSum) * 100;
  const diMinus = (dmMinus / trSum) * 100;
  const diSum = diPlus + diMinus;
  const dx = diSum ? (Math.abs(diPlus - diMinus) / diSum) * 100 : 0;
  return clamp(dx);
}

function calcVolatilityPercentile(snapshot) {
  const candles = Array.isArray(snapshot.candles) ? snapshot.candles : [];
  const price = Number(snapshot.price || 1);
  const atr = calcAtr(candles);
  const atrPct = price ? (atr / price) * 100 : 0;
  if (atrPct > 2.5) return 90;
  if (atrPct > 1.5) return 70;
  if (atrPct > 0.8) return 50;
  if (atrPct > 0.4) return 35;
  return 20;
}

function detectExpansionContraction(snapshot) {
  const candles = Array.isArray(snapshot.candles) ? snapshot.candles.slice(-10) : [];
  if (candles.length < 4) return 'neutral';
  const recent = candles.slice(-3).map(c => Number(c.high) - Number(c.low));
  const earlier = candles.slice(0, 3).map(c => Number(c.high) - Number(c.low));
  const recentAvg = avg(recent);
  const earlierAvg = avg(earlier) || 1;
  const ratio = recentAvg / earlierAvg;
  if (ratio > 1.35) return 'expansion';
  if (ratio < 0.7) return 'contraction';
  return 'neutral';
}

const REGIME_CONFIGS = {
  trending: {
    label: 'Trending',
    mood: 'Directional',
    color: '#00d26a',
    description: 'Market has strong directional momentum. Trend-following setups have elevated probability.',
    tradingBias: 'Follow the trend. Avoid counter-trend entries.',
  },
  ranging: {
    label: 'Range-Bound',
    mood: 'Ranging',
    color: '#3b82f6',
    description: 'Market is consolidating between clear support and resistance. Mean-reversion setups preferred.',
    tradingBias: 'Buy support, sell resistance. Avoid breakout trades.',
  },
  volatile: {
    label: 'Volatile',
    mood: 'High Risk',
    color: '#f59e0b',
    description: 'Market is showing abnormal volatility. Reduce position sizing and widen stops.',
    tradingBias: 'Use smaller size. Wait for volatility to compress before entering.',
  },
  expansion: {
    label: 'Expanding',
    mood: 'Breakout',
    color: '#8b5cf6',
    description: 'Range is expanding rapidly. A breakout from consolidation may be in progress.',
    tradingBias: 'Watch for breakout continuation. Enter only on confirmed close.',
  },
  contraction: {
    label: 'Contracting',
    mood: 'Coiling',
    color: '#06b6d4',
    description: 'Candle ranges are shrinking — a volatility squeeze. A large move is building.',
    tradingBias: 'Stay flat. Prepare for breakout in either direction.',
  },
};

export function detectMarketRegime(snapshot = {}) {
  const candles = Array.isArray(snapshot.candles) ? snapshot.candles : [];
  const changePercent = Math.abs(Number(snapshot.changePercent || 0));
  const adx = calcAdx(candles);
  const volPct = calcVolatilityPercentile(snapshot);
  const expansion = detectExpansionContraction(snapshot);

  let regime = 'ranging';
  if (volPct >= 80) {
    regime = 'volatile';
  } else if (expansion === 'contraction') {
    regime = 'contraction';
  } else if (expansion === 'expansion') {
    regime = 'expansion';
  } else if (adx >= 28 || changePercent >= 0.8) {
    regime = 'trending';
  } else {
    regime = 'ranging';
  }

  const direction = Number(snapshot.changePercent || 0) >= 0 ? 'Bullish' : 'Bearish';
  const trendStrength = clamp(adx);

  const MOODS = {
    trending:    direction === 'Bullish' ? 'Bullish' : 'Bearish',
    ranging:     'Neutral',
    volatile:    'High Risk',
    expansion:   direction === 'Bullish' ? 'Bullish' : 'Bearish',
    contraction: 'Low Risk',
  };

  const config = REGIME_CONFIGS[regime];

  return {
    regime,
    mood:          MOODS[regime] || 'Neutral',
    label:         config.label,
    color:         config.color,
    description:   config.description,
    tradingBias:   config.tradingBias,
    direction,
    trendStrength,
    volatilityPct: volPct,
    adx:           Math.round(adx),
    generatedAt:   new Date().toISOString(),
  };
}

export function getMarketMoodEmoji(mood) {
  const map = {
    'Bullish':   '🟢',
    'Bearish':   '🔴',
    'Neutral':   '🔵',
    'High Risk': '🟡',
    'Low Risk':  '⚪',
    'Breakout':  '🟣',
  };
  return map[mood] || '⚪';
}
