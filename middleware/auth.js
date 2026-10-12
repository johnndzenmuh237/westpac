const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.auth.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  });
}

function requireUser(req, res, next) {
  requireAuth(req, res, () => {
    if (req.auth.role !== 'user') return res.status(403).json({ error: 'User access required' });
    next();
  });
}

module.exports = { requireAuth, requireAdmin, requireUser };
