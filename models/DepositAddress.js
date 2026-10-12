const crypto = require('crypto');
const { db } = require('../config/db');

const format = (r) => r && { _id: r.id, id: r.id, coin: r.coin, network: r.network, address: r.address };

const DepositAddress = {
  list() {
    return db.prepare('SELECT * FROM deposit_addresses ORDER BY coin, network').all().map(format);
  },
  upsert({ coin, network, address }) {
    const now = Date.now();
    const existing = db.prepare('SELECT id FROM deposit_addresses WHERE coin = ? AND network = ?').get(coin, network);
    if (existing) {
      db.prepare('UPDATE deposit_addresses SET address = ?, updatedAt = ? WHERE id = ?').run(address, now, existing.id);
      return format(db.prepare('SELECT * FROM deposit_addresses WHERE id = ?').get(existing.id));
    }
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO deposit_addresses (id, coin, network, address, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, coin, network, address, now, now);
    return format(db.prepare('SELECT * FROM deposit_addresses WHERE id = ?').get(id));
  },
  remove(id) {
    return db.prepare('DELETE FROM deposit_addresses WHERE id = ?').run(id).changes > 0;
  }
};

module.exports = DepositAddress;
