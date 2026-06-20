'use strict';

function countBy(items, getKey) {
  return items.reduce((map, item) => {
    const key = getKey(item);
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
}

export class AnalyticsProvider {
  summarize(scanResult = {}, alerts = []) {
    const signals = Array.isArray(scanResult.signals) ? scanResult.signals : [];
    const directionCounts = countBy(signals, (signal) => signal.direction || 'Neutral');
    const averageSignalConfidence = signals.length
      ? Math.round(signals.reduce((sum, signal) => sum + (Number(signal.confidence) || 0), 0) / signals.length)
      : 0;

    return {
      signalCount: signals.length,
      highConfidenceCount: signals.filter((signal) => signal.confidence >= 70).length,
      alertCount: alerts.length,
      averageSignalConfidence,
      directionMix: {
        long: directionCounts.get('Long') || 0,
        short: directionCounts.get('Short') || 0,
        neutral: directionCounts.get('Neutral') || 0
      },
      headline: `${scanResult.bias || 'Neutral'} bias · ${scanResult.confidence || 0}% confidence`,
      status: scanResult.market?.cacheStatus === 'live' ? 'Live data' : 'Fallback model'
    };
  }
}
