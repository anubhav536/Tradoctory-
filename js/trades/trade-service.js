'use strict';

import { createTrade, TRADE_SCHEMA_VERSION } from './trade.js';
import { calculateTradeStatistics } from './trade-statistics.js';

export class TradeService {
  constructor({ repository, userId }) {
    this.repository = repository;
    this.userId = userId;
  }

  async listTrades() {
    const trades = await this.repository.findAll();
    return this.normalizeTrades(trades);
  }

  async seedTrades(trades) {
    const existingTrades = await this.repository.findAll();
    if (existingTrades.length) return this.normalizeTrades(existingTrades);

    const seededTrades = trades.map((trade) => createTrade({ ...trade, userId: this.userId }));
    await this.repository.saveAll(seededTrades);
    return seededTrades;
  }

  async addTrade(input) {
    const trade = createTrade({ ...input, userId: this.userId });
    return this.repository.create(trade);
  }

  async getStatistics() {
    const trades = await this.listTrades();
    return calculateTradeStatistics(trades);
  }

  async normalizeTrades(trades) {
    const normalizedTrades = trades.map((trade) => createTrade({ ...trade, userId: trade.userId || this.userId }));
    const needsPersistence = trades.some((trade, index) => trade.schemaVersion !== TRADE_SCHEMA_VERSION
      || trade.profitLoss !== normalizedTrades[index].profitLoss
      || trade.riskRewardRatio !== normalizedTrades[index].riskRewardRatio
      || trade.tradeResult !== normalizedTrades[index].tradeResult);

    if (needsPersistence) await this.repository.saveAll(normalizedTrades);
    return normalizedTrades;
  }
}
