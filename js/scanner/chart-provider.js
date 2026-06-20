'use strict';

export class ChartProvider {
  constructor({ chartGlobal = globalThis.Chart } = {}) {
    this.Chart = chartGlobal;
    this.instances = new Map();
  }

  renderConfidenceChart(canvas, scanResult = {}) {
    if (!canvas || !this.Chart) return false;
    const scores = scanResult.scores || {};
    const data = {
      labels: ['Bullish', 'Bearish', 'Range', 'Confidence'],
      datasets: [{
        label: 'Scanner score',
        data: [scores.bullish || 0, scores.bearish || 0, scores.rangePosition || 0, scanResult.confidence || 0],
        backgroundColor: ['#00d26a', '#ef4444', '#3b82f6', '#a855f7'],
        borderWidth: 0,
        borderRadius: 8
      }]
    };
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8090a8' }, grid: { display: false } },
        y: { min: 0, max: 100, ticks: { color: '#8090a8' }, grid: { color: 'rgba(255,255,255,0.06)' } }
      }
    };

    const existing = this.instances.get(canvas.id);
    if (existing) {
      existing.data = data;
      existing.options = options;
      existing.update();
      return true;
    }

    this.instances.set(canvas.id, new this.Chart(canvas.getContext('2d'), { type: 'bar', data, options }));
    return true;
  }
}
