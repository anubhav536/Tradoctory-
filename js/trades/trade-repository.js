'use strict';

/**
 * Storage contract for trade persistence.
 * LocalTradeRepository implements it for the MVP; a Firebase repository can
 * implement the same methods without changing TradeService or the UI layer.
 */
export class TradeRepository {
  async findAll() {
    throw new Error('TradeRepository.findAll() must be implemented.');
  }

  async saveAll() {
    throw new Error('TradeRepository.saveAll() must be implemented.');
  }

  async create() {
    throw new Error('TradeRepository.create() must be implemented.');
  }
}
