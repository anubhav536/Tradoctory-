'use strict';

import { runNiftyBeastRules } from './nifty-beast-rules.js';

export class ScannerProvider {
  constructor({ marketDataProvider, rulesEngine = runNiftyBeastRules } = {}) {
    if (!marketDataProvider) throw new Error('ScannerProvider requires a marketDataProvider.');
    this.marketDataProvider = marketDataProvider;
    this.rulesEngine = rulesEngine;
    this.lastResult = null;
  }

  async scan({ forceRefresh = false } = {}) {
    const market = await this.marketDataProvider.getSnapshot({ forceRefresh });
    const analysis = this.rulesEngine(market);
    this.lastResult = {
      schemaVersion: 'tradoctory.nifty-beast.scan.v1',
      generatedAt: analysis.generatedAt,
      market,
      ...analysis
    };
    return this.lastResult;
  }
}
