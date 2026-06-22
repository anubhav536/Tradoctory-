'use strict';

import { LocalTradeRepository } from './trades/local-trade-repository.js';

const DEFAULT_DATA_SOURCE = 'local';

/**
 * Dashboard repository factory.
 *
 * Keep dashboard code independent from persistence. Today it uses localStorage;
 * when Firebase is enabled, switch the dataSource option (or wire it from config)
 * and keep the same TradeRepository contract for the rest of the frontend.
 */
export async function createDashboardTradeRepository({ userId, dataSource = DEFAULT_DATA_SOURCE } = {}) {
  if (dataSource === 'firebase') {
    const { FirebaseTradeRepository } = await import('./trades/firebase-trade-repository.js');
    return new FirebaseTradeRepository({ userId });
  }

  return new LocalTradeRepository({ userId });
}
