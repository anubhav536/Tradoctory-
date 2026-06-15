'use strict';

const BASE_STORAGE_KEY = 'tradoctory.trades';

function getStorageKey(userId) {
  return `${BASE_STORAGE_KEY}.${userId || 'guest'}`;
}

export class LocalTradeRepository {
  constructor({ storage = window.localStorage, userId = 'guest' } = {}) {
    this.storage = storage;
    this.userId = userId;
    this.storageKey = getStorageKey(userId);
  }

  async findAll() {
    const rawTrades = this.storage.getItem(this.storageKey);
    if (!rawTrades) return [];

    try {
      const parsedTrades = JSON.parse(rawTrades);
      return Array.isArray(parsedTrades) ? parsedTrades : [];
    } catch (error) {
      console.warn('Unable to parse saved trades. Resetting local trade store.', error);
      return [];
    }
  }

  async saveAll(trades) {
    this.storage.setItem(this.storageKey, JSON.stringify(trades));
    return trades;
  }

  async create(trade) {
    const trades = await this.findAll();
    const nextTrades = [trade, ...trades];
    await this.saveAll(nextTrades);
    return trade;
  }
}
