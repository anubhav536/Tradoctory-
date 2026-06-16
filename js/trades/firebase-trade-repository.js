'use strict';

import { TradeRepository } from './trade-repository.js';

/**
 * Firebase migration seam.
 *
 * Later, inject Firestore helpers here and keep the public methods identical:
 * - findAll(): query users/{userId}/trades ordered by createdAt desc
 * - saveAll(trades): batch write normalized trade objects
 * - create(trade): add/set one normalized trade object
 */
export class FirebaseTradeRepository extends TradeRepository {
  constructor({ userId }) {
    super();
    this.userId = userId;
  }

  async findAll() {
    throw new Error('FirebaseTradeRepository.findAll() is not connected yet.');
  }

  async saveAll() {
    throw new Error('FirebaseTradeRepository.saveAll() is not connected yet.');
  }

  async create() {
    throw new Error('FirebaseTradeRepository.create() is not connected yet.');
  }
}
