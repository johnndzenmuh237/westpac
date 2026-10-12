const { db } = require('../config/db');

const SupportSettings = {
  get() {
    const row = db.prepare('SELECT email, whatsapp FROM support_settings WHERE id = 1').get();
    return { email: row?.email || '', whatsapp: row?.whatsapp || '' };
  },
  set({ email, whatsapp }) {
    const current = SupportSettings.get();
    const next = {
      email: email !== undefined ? String(email).trim() : current.email,
      whatsapp: whatsapp !== undefined ? String(whatsapp).trim() : current.whatsapp
    };
    db.prepare(`INSERT INTO support_settings (id, email, whatsapp) VALUES (1, ?, ?)
                ON CONFLICT(id) DO UPDATE SET email = excluded.email, whatsapp = excluded.whatsapp`)
      .run(next.email, next.whatsapp);
    return next;
  }
};

module.exports = SupportSettings;
