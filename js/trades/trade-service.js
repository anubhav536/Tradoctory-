'use strict';

import { createTrade } from './trade.js';

export class TradeService {
  constructor({ repository, userId }) {
    this.repository = repository;
    this.userId = userId;
  }

  async listTrades() {
    return this.repository.findAll();
  }

  async seedTrades(trades) {
    const existingTrades = await this.repository.findAll();
    if (existingTrades.length) return existingTrades;

    const seededTrades = trades.map((trade) => createTrade({ ...trade, userId: this.userId }));
    await this.repository.saveAll(seededTrades);
    return seededTrades;
  }

  async addTrade(input) {
    const trade = createTrade({ ...input, userId: this.userId });
    return this.repository.create(trade);
  }
}
