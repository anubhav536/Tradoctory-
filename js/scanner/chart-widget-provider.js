'use strict';

/* ===================================================
   TRADOCTORY — CHART WIDGET PROVIDER
   Embeds TradingView widgets for live charts.
   Falls back to Chart.js canvas on failure.
   Supports: 1m, 5m, 15m, 1H, 4H, Daily
   =================================================== */

const WIDGET_LOAD_TIMEOUT_MS = 8000;

const INTERVAL_MAP = {
  '1m':    '1',
  '5m':    '5',
  '15m':   '15',
  '1H':    '60',
  '4H':    '240',
  'Daily': 'D',
};

const DARK_THEME_CONFIG = {
  theme:            'dark',
  style:            '1',
  toolbar_bg:       '#111827',
  container_bg:     '#111827',
  hide_top_toolbar: false,
  hide_legend:      false,
  save_image:       false,
  locale:           'en',
};

function buildTVUrl(tvSymbol, interval = '15m') {
  const iv   = INTERVAL_MAP[interval] || '15';
  const params = new URLSearchParams({
    symbol:           tvSymbol,
    interval:         iv,
    theme:            'dark',
    style:            '1',
    toolbar_bg:       '#111827',
    hide_top_toolbar: '0',
    hide_legend:      '0',
    save_image:       'false',
    locale:           'en',
    allow_symbol_change: 'true',
    container_id:     'tv_widget',
  });
  return `https://www.tradingview.com/widgetembed/?${params.toString()}`;
}

function buildFallbackCanvas(container, snapshot, interval, chartGlobal) {
  if (!chartGlobal) {
    container.innerHTML = `
      <div class="chart-empty" style="height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;">
        <div style="font-size:14px;color:var(--text-secondary)">Chart unavailable</div>
        <div style="font-size:12px;color:var(--text-muted)">${snapshot?.displayName || snapshot?.symbol || 'Asset'}</div>
      </div>`;
    return;
  }

  const candles = Array.isArray(snapshot?.candles) ? snapshot.candles : [];
  const labels  = candles.map((_, i) => i % 4 === 0 ? new Date(candles[i]?.time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : '');
  const closes  = candles.map(c => Number(c.close || 0));
  const volumes = candles.map(c => Number(c.volume || 0));

  const canvasId = `fb_canvas_${Math.random().toString(36).slice(2, 8)}`;
  container.innerHTML = `
    <div style="position:relative;width:100%;height:100%;padding:8px;box-sizing:border-box;">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;padding-left:4px;">
        ${snapshot?.displayName || snapshot?.symbol} · ${interval} · Fallback Model
      </div>
      <canvas id="${canvasId}" style="width:100%;height:calc(100% - 24px);"></canvas>
    </div>`;

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const chg = Number(snapshot?.changePercent || 0);
  const lineColor = chg >= 0 ? '#00d26a' : '#ef4444';
  const fillColor = chg >= 0 ? 'rgba(0,210,106,0.10)' : 'rgba(239,68,68,0.10)';

  new chartGlobal(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: snapshot?.symbol,
        data: closes,
        borderColor: lineColor,
        backgroundColor: fillColor,
        fill: true,
        tension: 0.28,
        pointRadius: 0,
        borderWidth: 1.5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${snapshot?.symbol}: ${Number(ctx.parsed.y).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
          },
        },
      },
      scales: {
        x: { display: false },
        y: {
          ticks: { color: '#8090a8', maxTicksLimit: 4, callback: v => v.toLocaleString(undefined, { maximumFractionDigits: 2 }) },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
      },
    },
  });
}

export class ChartWidgetProvider {
  constructor({ chartGlobal = globalThis.Chart } = {}) {
    this.Chart      = chartGlobal;
    this.iframes    = new Map();
    this.snapshots  = new Map();
    this.intervals  = new Map();
  }

  /**
   * Mount a chart for an asset into a container element.
   * Tries TradingView iframe first; falls back to Chart.js.
   * @param {HTMLElement} container
   * @param {object} asset       - from symbol-database.js
   * @param {object} snapshot    - from MarketDataProvider / fallback
   * @param {string} interval    - '1m'|'5m'|'15m'|'1H'|'4H'|'Daily'
   */
  mountChart(container, asset, snapshot, interval = '15m') {
    if (!container) return;
    const key = asset.symbol;
    this.snapshots.set(key, snapshot);
    this.intervals.set(key, interval);
    this._renderWidget(container, asset, snapshot, interval);
  }

  _renderWidget(container, asset, snapshot, interval) {
    if (!asset.tvSymbol) {
      buildFallbackCanvas(container, snapshot, interval, this.Chart);
      return;
    }

    container.innerHTML = '';
    const iframe  = document.createElement('iframe');
    iframe.src    = buildTVUrl(asset.tvSymbol, interval);
    iframe.title  = `${asset.name} ${interval} chart`;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowtransparency', 'true');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:8px;display:block;';

    const timeout = setTimeout(() => {
      if (!iframe.isConnected) return;
      iframe.remove();
      buildFallbackCanvas(container, snapshot, interval, this.Chart);
    }, WIDGET_LOAD_TIMEOUT_MS);

    iframe.addEventListener('load', () => clearTimeout(timeout), { once: true });
    iframe.addEventListener('error', () => {
      clearTimeout(timeout);
      iframe.remove();
      buildFallbackCanvas(container, snapshot, interval, this.Chart);
    }, { once: true });

    container.appendChild(iframe);
    this.iframes.set(asset.symbol, iframe);
  }

  /**
   * Change the timeframe of an existing mounted chart.
   */
  changeInterval(container, asset, interval) {
    const snapshot = this.snapshots.get(asset.symbol);
    this.intervals.set(asset.symbol, interval);
    this._renderWidget(container, asset, snapshot, interval);
  }

  /**
   * Destroy all mounted charts (cleanup on page unload).
   */
  destroyAll() {
    this.iframes.forEach(f => f?.remove());
    this.iframes.clear();
  }
}
