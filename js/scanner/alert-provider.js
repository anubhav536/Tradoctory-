'use strict';

function createAlert({ id, severity, title, message, signalId }) {
  return { id, severity, title, message, signalId, createdAt: new Date().toISOString() };
}

export class AlertProvider {
  constructor({ confidenceThreshold = 70 } = {}) {
    this.confidenceThreshold = confidenceThreshold;
  }

  evaluate(scanResult = {}) {
    const alerts = [];
    const signals = Array.isArray(scanResult.signals) ? scanResult.signals : [];
    signals.forEach((signal) => {
      if (signal.confidence >= this.confidenceThreshold && signal.direction !== 'Neutral') {
        alerts.push(createAlert({
          id: `alert-${signal.id}`,
          severity: signal.severity === 'danger' ? 'danger' : 'success',
          title: `${signal.direction} setup armed`,
          message: `${signal.title}: ${signal.trigger}`,
          signalId: signal.id
        }));
      }
    });

    if (scanResult.market?.marketStatus === 'closed') {
      alerts.push(createAlert({
        id: 'market-closed-prep',
        severity: 'info',
        title: 'Preparation mode',
        message: 'Nifty market appears closed; use scanner output for planning only.',
        signalId: 'market-status'
      }));
    }

    if ((scanResult.confidence || 0) < 58) {
      alerts.push(createAlert({
        id: 'low-confidence-filter',
        severity: 'warning',
        title: 'Low-confidence filter',
        message: 'Scanner confidence is below execution threshold. Wait for cleaner alignment.',
        signalId: 'confidence'
      }));
    }

    return alerts;
  }
}
