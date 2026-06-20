'use strict';

/* ===================================================
   TRADOCTORY — MULTI-TIMEFRAME ENGINE
   Confirms signals across: Daily / 4H / 1H / 15m
   Applies score penalty when higher TFs disagree.
   =================================================== */

function clamp(v, min = 0, max = 100) { return Math.min(max, Math.max(min, v)); }
function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }

const TIMEFRAMES = [
  { key: 'daily', label: 'Daily',  weight: 0.40, candleCount: 1  },
  { key: '4h',    label: '4H',     weight: 0.30, candleCount: 6  },
  { key: '1h',    label: '1H',     weight: 0.20, candleCount: 24 },
  { key: '15m',   label: '15m',    weight: 0.10, candleCount: 96 },
];

function getBiasFromCandles(candles, count) {
  if (!candles || candles.length < 2) return 'neutral';
  const slice = candles.slice(-Math.min(count, candles.length));
  const first = Number(slice[0]?.close || slice[0]?.open || 0);
  const last  = Number(slice[slice.length - 1]?.close || 0);
  if (!first) return 'neutral';
  const pct = ((last - first) / first) * 100;
  if (pct > 0.25) return 'bullish';
  if (pct < -0.25) return 'bearish';
  return 'neutral';
}

function downsampleCandles(candles, targetCount) {
  if (!candles || candles.length <= targetCount) return candles || [];
  const ratio = Math.floor(candles.length / targetCount);
  const result = [];
  for (let i = 0; i < candles.length; i += ratio) {
    const chunk = candles.slice(i, i + ratio);
    if (!chunk.length) continue;
    result.push({
      time:   chunk[0].time,
      open:   chunk[0].open,
      high:   Math.max(...chunk.map(c => Number(c.high))),
      low:    Math.min(...chunk.map(c => Number(c.low))),
      close:  chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, c) => s + Number(c.volume || 0), 0),
    });
  }
  return result;
}

function getTfBias(snapshot, tf) {
  const candles = Array.isArray(snapshot.candles) ? snapshot.candles : [];
  const sampled = downsampleCandles(candles, tf.candleCount * 2);
  return getBiasFromCandles(sampled, tf.candleCount);
}

/**
 * Analyse multi-timeframe alignment for a snapshot.
 * Returns alignment score, penalty, and per-TF breakdown.
 *
 * @param {object} snapshot
 * @param {string} direction  - 'Bullish' | 'Bearish' | 'Neutral'
 * @returns {object}
 */
export function analyseMultiTimeframe(snapshot = {}, direction = 'Neutral') {
  const targetBias = direction.toLowerCase() === 'bullish' ? 'bullish'
    : direction.toLowerCase() === 'bearish' ? 'bearish'
    : 'neutral';

  const tfResults = TIMEFRAMES.map(tf => {
    const bias = getTfBias(snapshot, tf);
    const aligned = bias === targetBias || (targetBias === 'neutral' && bias === 'neutral');
    const conflicting = bias !== 'neutral' && bias !== targetBias;
    return {
      key:        tf.key,
      label:      tf.label,
      weight:     tf.weight,
      bias,
      aligned,
      conflicting,
    };
  });

  const weightedAlignment = tfResults.reduce((sum, tf) => {
    return sum + (tf.aligned ? tf.weight : tf.conflicting ? -tf.weight * 0.5 : 0);
  }, 0);

  const alignmentScore = clamp(50 + weightedAlignment * 100);
  const penalty = tfResults
    .filter(tf => tf.conflicting && (tf.key === 'daily' || tf.key === '4h'))
    .reduce((sum, tf) => sum + (tf.key === 'daily' ? 25 : 15), 0);

  const alignedCount    = tfResults.filter(t => t.aligned).length;
  const conflictCount   = tfResults.filter(t => t.conflicting).length;
  const allAligned      = alignedCount === TIMEFRAMES.length;
  const majorConflict   = tfResults.some(t => t.conflicting && (t.key === 'daily' || t.key === '4h'));

  return {
    timeframes:    tfResults,
    alignmentScore,
    penalty,
    alignedCount,
    conflictCount,
    allAligned,
    majorConflict,
    summary: allAligned
      ? `All ${TIMEFRAMES.length} timeframes aligned — strong confluence`
      : majorConflict
      ? `Higher timeframe conflict detected — score penalised`
      : `${alignedCount}/${TIMEFRAMES.length} timeframes aligned`,
  };
}
