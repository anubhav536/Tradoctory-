'use strict';

/* ===================================================
   TRADOCTORY — MULTI-SYMBOL SCANNER ORCHESTRATOR
   Scans all assets, scores each, ranks by tier.
   Implements Market Hunter Mode:
   Top 10 → 5 → 3 → 2 → Best Setup
   =================================================== */

import { SCANNABLE_ASSETS } from './symbol-database.js';
import { runNiftyBeastRules } from './nifty-beast-rules.js';
import { detectMarketRegime } from './market-regime-engine.js';
import { rankSectors } from './sector-strength-engine.js';
import { analyseMultiTimeframe } from './multi-timeframe-engine.js';
import { scoreSetup } from './scoring-engine.js';
import { explainSetup } from './ai-explanation-engine.js';
import { checkAlertGates, formatTelegramAlert, formatCompactAlert } from './telegram-alert-formatter.js';

const SCAN_CACHE_TTL_MS = 60 * 1000;

function roundTo(v, p = 2) {
  const m = 10 ** p;
  return Math.round((Number(v || 0) + Number.EPSILON) * m) / m;
}

function createFallbackSnapshot(asset, now = new Date()) {
  const seed = Math.floor(now.getTime() / (5 * 60 * 1000));
  const symSeed = asset.symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const cycle = Math.sin((seed + symSeed) / 7);
  const secondaryCycle = Math.cos((seed + symSeed) / 11);
  const base = asset.basePrice || 100;
  const changePct = (cycle * 0.8) + (secondaryCycle * 0.3);
  const price = roundTo(base * (1 + changePct / 100));
  const open  = roundTo(base * (1 + secondaryCycle * 0.4 / 100));
  const dayRange = base * (0.006 + Math.abs(cycle) * 0.003);

  const candles = Array.from({ length: 24 }, (_, i) => {
    const age   = 23 - i;
    const wave  = Math.sin((i + seed) / 3.5);
    const close = roundTo(base + (price - base) * (i / 23) + wave * base * 0.002);
    const open_ = roundTo(close - wave * base * 0.001);
    return {
      time:   new Date(now.getTime() - age * 15 * 60 * 1000).toISOString(),
      open:   open_,
      high:   roundTo(Math.max(open_, close) + base * 0.0015),
      low:    roundTo(Math.min(open_, close) - base * 0.0015),
      close,
      volume: Math.round(1000000 + Math.abs(wave) * 500000),
    };
  });

  return {
    symbol:        asset.symbol,
    displayName:   asset.name,
    price,
    open,
    high:          roundTo(Math.max(price, open) + dayRange * 0.48),
    low:           roundTo(Math.min(price, open) - dayRange * 0.52),
    previousClose: base,
    change:        roundTo(price - base),
    changePercent: roundTo(changePct),
    volume:        Math.round(5000000 + Math.abs(cycle) * 2000000),
    timestamp:     now.toISOString(),
    source:        'simulated-fallback',
    cacheStatus:   'fallback',
    marketStatus:  'open',
    sector:        asset.sector || null,
    assetType:     asset.assetType || 'index',
    category:      asset.category || 'Index',
    candles,
  };
}

async function fetchYahooSnapshot(asset, fetchImpl) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.yahooSymbol)}?interval=15m&range=1d&includePrePost=false`;
  const res = await fetchImpl(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('No chart result');

  const meta       = result.meta || {};
  const timestamps = result.timestamp || [];
  const ohlcv      = result.indicators?.quote?.[0] || {};
  const price      = roundTo(meta.regularMarketPrice || meta.previousClose || asset.basePrice);
  const prevClose  = roundTo(meta.chartPreviousClose || meta.previousClose || price);
  const change     = roundTo(price - prevClose);

  const candles = timestamps.map((t, i) => ({
    time:   new Date(t * 1000).toISOString(),
    open:   roundTo(ohlcv.open?.[i] || price),
    high:   roundTo(ohlcv.high?.[i] || price),
    low:    roundTo(ohlcv.low?.[i] || price),
    close:  roundTo(ohlcv.close?.[i] || price),
    volume: Math.round(ohlcv.volume?.[i] || 0),
  })).filter(c => c.close > 0);

  return {
    symbol:        asset.symbol,
    displayName:   asset.name,
    price,
    open:          roundTo(meta.regularMarketOpen || price),
    high:          roundTo(meta.regularMarketDayHigh || price),
    low:           roundTo(meta.regularMarketDayLow || price),
    previousClose: prevClose,
    change,
    changePercent: roundTo((change / prevClose) * 100),
    volume:        Math.round(meta.regularMarketVolume || 0),
    timestamp:     new Date().toISOString(),
    source:        'yahoo-finance',
    cacheStatus:   'live',
    marketStatus:  'open',
    sector:        asset.sector || null,
    assetType:     asset.assetType || 'index',
    category:      asset.category || 'Index',
    candles,
  };
}

async function getSnapshotWithFallback(asset, fetchImpl, cache) {
  const cacheKey = asset.symbol;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.at < SCAN_CACHE_TTL_MS) return cached.snapshot;

  let snapshot;
  try {
    if (fetchImpl) {
      snapshot = await fetchYahooSnapshot(asset, fetchImpl);
    } else {
      throw new Error('No fetch available');
    }
  } catch (_err) {
    snapshot = createFallbackSnapshot(asset, new Date());
  }

  cache.set(cacheKey, { at: now, snapshot });
  return snapshot;
}

export class MultiSymbolScanner {
  constructor({ fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
    this.fetchImpl = fetchImpl;
    this.cache     = new Map();
    this.lastResult = null;
  }

  async scanAll({ forceRefresh = false } = {}) {
    if (!forceRefresh && this.lastResult &&
        Date.now() - this.lastResult.generatedAt < SCAN_CACHE_TTL_MS) {
      return this.lastResult;
    }

    const niftyAsset = SCANNABLE_ASSETS.find(a => a.symbol === 'NIFTY');
    const niftySnapshot = await getSnapshotWithFallback(
      niftyAsset || SCANNABLE_ASSETS[0], this.fetchImpl, this.cache
    );

    const regime        = detectMarketRegime(niftySnapshot);
    const sectorRanking = rankSectors(niftySnapshot);

    const allSnapshots = await Promise.all(
      SCANNABLE_ASSETS.map(asset => getSnapshotWithFallback(asset, this.fetchImpl, this.cache))
    );

    const scoredSetups = allSnapshots.map(snapshot => {
      const direction   = Number(snapshot.changePercent || 0) >= 0 ? 'Bullish' : 'Bearish';
      const mtfAnalysis = analyseMultiTimeframe(snapshot, direction);
      const scored      = scoreSetup(snapshot, {
        regime,
        sectorRanking,
        mtfAnalysis,
        marketSnapshot: niftySnapshot,
      });
      const explanation = explainSetup(scored, { regime, sectorRanking, mtfAnalysis });
      const gateResult  = checkAlertGates(scored, { regime, mtfAnalysis });
      const telegramAlert = gateResult.pass
        ? formatTelegramAlert(scored, explanation, { regime })
        : null;
      const compactAlert = gateResult.pass ? formatCompactAlert(scored) : null;

      return {
        ...scored,
        explanation,
        mtfAnalysis,
        alertGate:    gateResult,
        telegramAlert,
        compactAlert,
      };
    });

    const accepted   = scoredSetups.filter(s => s.score >= 7.0)
                                   .sort((a, b) => b.score - a.score);
    const rejected   = scoredSetups.filter(s => s.score < 7.0);
    const top10      = accepted.slice(0, 10);
    const top5       = accepted.slice(0, 5);
    const top3       = accepted.slice(0, 3);
    const top2       = accepted.slice(0, 2);
    const bestSetup  = accepted[0] || null;

    const noTradeMode = accepted.length === 0;
    const sTierCount  = accepted.filter(s => s.tier === 'S').length;
    const aTierCount  = accepted.filter(s => s.tier === 'A').length;
    const bTierCount  = accepted.filter(s => s.tier === 'B').length;

    const telegramSetups = accepted.filter(s => s.telegramAlert !== null);

    const watchlist = top10.map(s => ({
      symbol:    s.symbol,
      name:      s.name || s.symbol,
      score:     s.score,
      tier:      s.tier,
      tierLabel: s.tierLabel,
      tierColor: s.tierColor,
      tierEmoji: s.tierEmoji,
      direction: s.direction,
      category:  s.snapshot?.category || 'Asset',
    }));

    const result = {
      generatedAt:    Date.now(),
      isoTime:        new Date().toISOString(),
      regime,
      sectorRanking,
      noTradeMode,
      totalScanned:   scoredSetups.length,
      acceptedCount:  accepted.length,
      rejectedCount:  rejected.length,
      sTierCount,
      aTierCount,
      bTierCount,
      top10,
      top5,
      top3,
      top2,
      bestSetup,
      telegramSetups,
      watchlist,
      niftySnapshot,
      dataSource:     allSnapshots[0]?.source || 'fallback',
      isLiveData:     allSnapshots.some(s => s.cacheStatus === 'live'),
    };

    this.lastResult = result;
    this._saveWatchlist(watchlist);
    return result;
  }

  _saveWatchlist(watchlist) {
    try {
      localStorage.setItem('trdctr_scanner_watchlist', JSON.stringify({
        updatedAt: new Date().toISOString(),
        items: watchlist,
      }));
    } catch (_e) { /* storage full */ }
  }

  getWatchlist() {
    try {
      const raw = localStorage.getItem('trdctr_scanner_watchlist');
      return raw ? JSON.parse(raw) : { items: [] };
    } catch { return { items: [] }; }
  }
}
