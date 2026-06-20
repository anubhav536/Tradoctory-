'use strict';

function roundTo(value, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round((Number(value || 0) + Number.EPSILON) * multiplier) / multiplier;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function getRange(snapshot) {
  return Math.max(Number(snapshot.high) - Number(snapshot.low), 1);
}

function getCandleMomentum(candles = []) {
  if (candles.length < 2) return 0;
  const recent = candles.slice(-6);
  const first = Number(recent[0]?.close ?? recent[0]?.open ?? 0);
  const last = Number(recent.at(-1)?.close ?? 0);
  return first ? ((last - first) / first) * 100 : 0;
}

function getVolumeStrength(snapshot) {
  const candles = Array.isArray(snapshot.candles) ? snapshot.candles : [];
  const recentVolume = Number(candles.at(-1)?.volume || snapshot.volume || 0);
  const averageVolume = average(candles.slice(-12).map((candle) => Number(candle.volume || 0)).filter(Boolean)) || recentVolume;
  return averageVolume ? recentVolume / averageVolume : 1;
}

function createSignal({ id, title, direction, confidence, message, trigger, risk, severity = 'info' }) {
  return {
    id,
    title,
    direction,
    confidence: clamp(Math.round(confidence)),
    message,
    trigger,
    risk,
    severity
  };
}

export function runNiftyBeastRules(snapshot = {}) {
  const price = Number(snapshot.price || 0);
  const open = Number(snapshot.open || price);
  const previousClose = Number(snapshot.previousClose || price);
  const high = Number(snapshot.high || price);
  const low = Number(snapshot.low || price);
  const changePercent = Number(snapshot.changePercent || 0);
  const dayRange = getRange({ high, low });
  const rangePosition = ((price - low) / dayRange) * 100;
  const momentum = getCandleMomentum(snapshot.candles);
  const volumeStrength = getVolumeStrength(snapshot);
  const aboveOpen = price >= open;
  const abovePreviousClose = price >= previousClose;
  const bullishScore = clamp((aboveOpen ? 22 : 0) + (abovePreviousClose ? 18 : 0) + Math.max(changePercent, 0) * 18 + Math.max(momentum, 0) * 12 + Math.max(rangePosition - 50, 0) * 0.55 + Math.max(volumeStrength - 1, 0) * 18);
  const bearishScore = clamp((!aboveOpen ? 22 : 0) + (!abovePreviousClose ? 18 : 0) + Math.max(-changePercent, 0) * 18 + Math.max(-momentum, 0) * 12 + Math.max(50 - rangePosition, 0) * 0.55 + Math.max(volumeStrength - 1, 0) * 12);
  const scoreGap = bullishScore - bearishScore;
  const bias = scoreGap > 12 ? 'Bullish' : scoreGap < -12 ? 'Bearish' : 'Neutral';
  const confidence = clamp(46 + Math.abs(scoreGap) * 0.45 + Math.min(Math.abs(changePercent) * 8, 18) + Math.min(Math.abs(momentum) * 5, 14));
  const resistance = roundTo(high + (dayRange * 0.12));
  const support = roundTo(low - (dayRange * 0.12));
  const midpoint = roundTo((high + low) / 2);
  const signals = [];

  if (bias === 'Bullish') {
    signals.push(createSignal({
      id: 'bullish-breakout-watch',
      title: 'Bullish breakout watch',
      direction: 'Long',
      confidence,
      message: 'Price is holding above open and previous close with improving intraday momentum.',
      trigger: `Sustained trade above ${resistance}`,
      risk: `Invalidation below ${midpoint}`,
      severity: confidence >= 72 ? 'success' : 'info'
    }));
  }

  if (bias === 'Bearish') {
    signals.push(createSignal({
      id: 'bearish-breakdown-watch',
      title: 'Bearish breakdown watch',
      direction: 'Short',
      confidence,
      message: 'Price is trading below key intraday references with downside pressure.',
      trigger: `Sustained trade below ${support}`,
      risk: `Invalidation above ${midpoint}`,
      severity: confidence >= 72 ? 'danger' : 'warning'
    }));
  }

  if (rangePosition > 42 && rangePosition < 58 && Math.abs(changePercent) < 0.35) {
    signals.push(createSignal({
      id: 'range-compression',
      title: 'Range compression',
      direction: 'Neutral',
      confidence: 58,
      message: 'Nifty is balanced near the session midpoint; wait for expansion before forcing direction.',
      trigger: `Break and hold beyond ${high} / ${low}`,
      risk: 'Avoid low R:R entries inside the range.',
      severity: 'info'
    }));
  }

  if (volumeStrength >= 1.12 && Math.abs(momentum) >= 0.12) {
    signals.push(createSignal({
      id: 'volume-confirmed-momentum',
      title: 'Volume-confirmed momentum',
      direction: momentum > 0 ? 'Long' : 'Short',
      confidence: 64 + Math.min((volumeStrength - 1) * 18, 18),
      message: 'Recent candle flow is stronger than baseline volume, confirming active participation.',
      trigger: momentum > 0 ? `Pullback hold above ${midpoint}` : `Retest rejection below ${midpoint}`,
      risk: 'Reduce size if follow-through stalls for two candles.',
      severity: 'success'
    }));
  }

  if (!signals.length) {
    signals.push(createSignal({
      id: 'risk-off-observation',
      title: 'No-trade filter active',
      direction: 'Neutral',
      confidence: 52,
      message: 'Scanner does not see enough directional edge for a high-quality setup.',
      trigger: 'Wait for price, range, and momentum alignment.',
      risk: 'Avoid impulse entries while confidence is below threshold.',
      severity: 'warning'
    }));
  }

  return {
    engine: 'nifty-beast-rules.v1',
    generatedAt: new Date().toISOString(),
    bias,
    confidence: Math.round(confidence),
    scores: {
      bullish: Math.round(bullishScore),
      bearish: Math.round(bearishScore),
      rangePosition: Math.round(rangePosition),
      momentum: roundTo(momentum),
      volumeStrength: roundTo(volumeStrength, 2)
    },
    levels: { support, resistance, midpoint },
    riskNotes: [
      'Educational scanner output only — not financial advice.',
      confidence < 60 ? 'Use smaller size or wait for confirmation while confidence is moderate.' : 'Require stop placement before acting on any setup.',
      snapshot.marketStatus === 'closed' ? 'Market appears closed; treat signals as preparation, not live execution.' : 'Market appears open; confirm with your broker chart before execution.'
    ],
    signals: signals.sort((a, b) => b.confidence - a.confidence)
  };
}
