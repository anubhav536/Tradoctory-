'use strict';

const DEFAULT_CACHE_TTL_MS = 60 * 1000;

function roundTo(value, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round((Number(value || 0) + Number.EPSILON) * multiplier) / multiplier;
}

function createFallbackSnapshot(now = new Date()) {
  const seed = Math.floor(now.getTime() / (5 * 60 * 1000));
  const cycle = Math.sin(seed / 7);
  const secondaryCycle = Math.cos(seed / 11);
  const previousClose = 23550;
  const change = roundTo((cycle * 82) + (secondaryCycle * 28));
  const price = roundTo(previousClose + change);
  const open = roundTo(previousClose + (secondaryCycle * 34));
  const dayRange = 145 + Math.abs(cycle * 65);

  return {
    symbol: 'NIFTY',
    displayName: 'Nifty 50',
    price,
    open,
    high: roundTo(Math.max(price, open) + (dayRange * 0.48)),
    low: roundTo(Math.min(price, open) - (dayRange * 0.52)),
    previousClose,
    change,
    changePercent: roundTo((change / previousClose) * 100),
    volume: Math.round(172000000 + (Math.abs(cycle) * 42000000)),
    timestamp: now.toISOString(),
    source: 'simulated-fallback',
    marketStatus: getIndianMarketStatus(now),
    candles: buildFallbackCandles(price, previousClose, now)
  };
}

function buildFallbackCandles(price, previousClose, now) {
  return Array.from({ length: 24 }, (_, index) => {
    const age = 23 - index;
    const wave = Math.sin((index + Math.floor(now.getTime() / 900000)) / 3);
    const close = roundTo(previousClose + ((price - previousClose) * (index / 23)) + (wave * 28));
    const open = roundTo(close - (wave * 12));
    return {
      time: new Date(now.getTime() - (age * 15 * 60 * 1000)).toISOString(),
      open,
      high: roundTo(Math.max(open, close) + 18 + Math.abs(wave * 10)),
      low: roundTo(Math.min(open, close) - 18 - Math.abs(wave * 8)),
      close,
      volume: Math.round(5000000 + (Math.abs(wave) * 2600000))
    };
  });
}

function getIndianMarketStatus(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date).reduce((values, part) => ({ ...values, [part.type]: part.value }), {});
  const weekday = parts.weekday;
  const minutes = (Number(parts.hour) * 60) + Number(parts.minute);
  const isWeekday = !['Sat', 'Sun'].includes(weekday);
  const isOpen = isWeekday && minutes >= ((9 * 60) + 15) && minutes <= ((15 * 60) + 30);
  return isOpen ? 'open' : 'closed';
}

function normalizeSnapshot(input = {}, fallback = createFallbackSnapshot()) {
  const price = roundTo(input.price ?? input.last ?? input.close ?? fallback.price);
  const previousClose = roundTo(input.previousClose ?? input.prevClose ?? fallback.previousClose);
  const change = roundTo(input.change ?? (price - previousClose));

  return {
    symbol: String(input.symbol || fallback.symbol || 'NIFTY').toUpperCase(),
    displayName: input.displayName || fallback.displayName || 'Nifty 50',
    price,
    open: roundTo(input.open ?? fallback.open ?? price),
    high: roundTo(input.high ?? fallback.high ?? price),
    low: roundTo(input.low ?? fallback.low ?? price),
    previousClose,
    change,
    changePercent: roundTo(input.changePercent ?? ((change / previousClose) * 100)),
    volume: Number(input.volume ?? fallback.volume ?? 0),
    timestamp: input.timestamp || new Date().toISOString(),
    source: input.source || 'external',
    marketStatus: input.marketStatus || getIndianMarketStatus(),
    candles: Array.isArray(input.candles) && input.candles.length ? input.candles : fallback.candles
  };
}

export class MarketDataProvider {
  constructor({ endpoint = '', fetchImpl = globalThis.fetch?.bind(globalThis), cacheTtlMs = DEFAULT_CACHE_TTL_MS } = {}) {
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl;
    this.cacheTtlMs = cacheTtlMs;
    this.cache = null;
  }

  async getSnapshot({ forceRefresh = false } = {}) {
    const now = Date.now();
    if (!forceRefresh && this.cache && now - this.cache.cachedAt < this.cacheTtlMs) {
      return { ...this.cache.snapshot, cacheStatus: 'fresh-cache' };
    }

    const fallback = createFallbackSnapshot(new Date());

    if (!this.endpoint || !this.fetchImpl) {
      return this.setCache({ ...fallback, cacheStatus: 'fallback' });
    }

    try {
      const response = await this.fetchImpl(this.endpoint, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Market data request failed: ${response.status}`);
      const payload = await response.json();
      return this.setCache({ ...normalizeSnapshot(payload, fallback), cacheStatus: 'live' });
    } catch (error) {
      console.warn('[Tradoctory] Falling back to simulated Nifty market data.', error);
      return this.setCache({ ...fallback, cacheStatus: 'fallback' });
    }
  }

  setCache(snapshot) {
    this.cache = { cachedAt: Date.now(), snapshot };
    return snapshot;
  }
}
