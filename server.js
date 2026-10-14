require('dotenv').config();

// Sensible defaults so a missing/incomplete .env can never stop the app.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'dev-only-secret-change-me';
  console.warn('Note: JWT_SECRET not set in .env - using a built-in dev secret.');
}
process.env.ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const express = require('express');
require('express-async-errors');
const cors = require('cors');
const path = require('path');
const { driver, DB_PATH } = require('./config/db'); // opens the local database file (synchronous - nothing to "connect" to)

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const userRoutes = require('./routes/user.routes');

const app = express();
app.use(cors());
app.use(express.json());
require('./server-routes')(app);
require('./loans-kyc-routes')(app);

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, 'public')));

// Error handler: friendly, specific messages instead of a generic failure.
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message, ...err.extra });
  console.error(err);
  if (err.code && String(err.code).startsWith('SQLITE_CONSTRAINT')) {
    return res.status(409).json({ error: 'That value is already in use' });
  }
  res.status(500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Westpac Global running on http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH} (${driver}) - local file, no internet or setup needed`);
});
