const crypto = require('crypto');

function genUsernameBase(name) {
  const base = (name || 'user').trim().toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, '') || 'user';
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${base}${suffix}`;
}

// Generates a unique username by retrying against a provided existence-check function.
async function generateUniqueUsername(name, existsFn) {
  let candidate;
  let tries = 0;
  do {
    candidate = genUsernameBase(name);
    tries += 1;
  } while ((await existsFn(candidate)) && tries < 50);
  return candidate;
}

function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

module.exports = { generateUniqueUsername, generatePassword };
