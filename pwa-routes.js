/* pwa-routes.js: serves the app icons, manifests and service worker straight from the server,
   so the app is installable without any separate icon or manifest files. */
const zlib = require('zlib');

const NAVY = [11, 37, 69], NAVY2 = [7, 26, 51], GOLD = [198, 161, 91], WHITE = [255, 255, 255];

/* ---------- tiny PNG encoder ---------- */
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(n, rgba) {
  const raw = Buffer.alloc((n * 4 + 1) * n);
  for (let y = 0; y < n; y++) { raw[y * (n * 4 + 1)] = 0; rgba.copy(raw, y * (n * 4 + 1) + 1, y * n * 4, (y + 1) * n * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- the "Global" logo: white globe with a gold orbit on navy ---------- */
function drawIcon(N, fullBleed, scale) {
  const out = Buffer.alloc(N * N * 4);
  const c = N / 2, r = N * 0.30 * scale, w = N * 0.028 * scale, hw = w / 2;
  const R = r * 1.22, wA = w * 1.6, rad = N * 0.22, SS = 3, rx = r * 0.45;
  const ex = c + R * Math.cos(340 * Math.PI / 180), ey = c + R * Math.sin(340 * Math.PI / 180);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let sr = 0, sg = 0, sb = 0, cov = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
      if (!fullBleed) {
        const qx = Math.abs(px - c) - (c - rad), qy = Math.abs(py - c) - (c - rad);
        const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
        if (d > 0) continue;
      }
      const t = (px + py) / (2 * N);
      let col = [NAVY[0] + (NAVY2[0] - NAVY[0]) * t, NAVY[1] + (NAVY2[1] - NAVY[1]) * t, NAVY[2] + (NAVY2[2] - NAVY[2]) * t];
      const dx = px - c, dy = py - c, dist = Math.hypot(dx, dy);
      let white = Math.abs(dist - r) <= hw;
      if (!white) {
        const e = Math.hypot(dx / rx, dy / r);
        if (e > 0.0001) white = Math.abs(e - 1) / Math.hypot(dx / (rx * rx * e), dy / (r * r * e)) <= hw;
      }
      if (!white && dist <= r) {
        white = Math.abs(dx) <= hw || Math.abs(dy) <= hw;
        for (const k of [-0.5, 0.5]) {
          if (!white && Math.abs(dy - r * k) <= hw && Math.abs(dx) <= Math.sqrt(r * r - r * r * k * k)) white = true;
        }
      }
      if (white) col = WHITE;
      let ang = Math.atan2(dy, dx) * 180 / Math.PI; if (ang < 0) ang += 360;
      if ((ang >= 200 && ang <= 340 && Math.abs(dist - R) <= wA / 2) || Math.hypot(px - ex, py - ey) <= w) col = GOLD;
      sr += col[0]; sg += col[1]; sb += col[2]; cov++;
    }
    const i = (y * N + x) * 4;
    if (cov) { out[i] = Math.round(sr / cov); out[i + 1] = Math.round(sg / cov); out[i + 2] = Math.round(sb / cov); out[i + 3] = Math.round(255 * cov / (SS * SS)); }
  }
  return encodePng(N, out);
}

const SPECS = {
  'icon-192': [192, false, 1], 'icon-512': [512, false, 1],
  'maskable-192': [192, true, 0.82], 'maskable-512': [512, true, 0.82],
  'apple-touch-icon': [180, true, 1], 'apple-touch-icon-167': [167, true, 1], 'apple-touch-icon-152': [152, true, 1],
  'favicon-32': [32, false, 1], 'favicon-48': [48, false, 1]
};
const cache = {};
function icon(name) {
  if (!SPECS[name]) return null;
  if (!cache[name]) cache[name] = drawIcon(SPECS[name][0], SPECS[name][1], SPECS[name][2]);
  return cache[name];
}

function manifest(admin) {
  return {
    id: admin ? '/?app=admin' : '/?app=user',
    name: 'Global', short_name: 'Global',
    description: 'Global - demo practice platform. No real funds.',
    start_url: admin ? '/admin-login.html' : '/login.html',
    scope: '/', display: 'standalone', orientation: 'portrait',
    background_color: '#0b2545', theme_color: '#0b2545',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}

const SW = `const CACHE = 'app-shell-v3';
const SHELL = ['/login.html', '/user.html', '/admin.html', '/admin-login.html', '/css/style.css'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api') || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (x) { d = { title: 'Notification', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    if (list.some(c => c.visibilityState === 'visible')) return;
    return self.registration.showNotification(d.title || 'Notification', {
      body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/favicon-48.png',
      data: { url: d.url || '/' }, tag: 'n-' + Date.now()
    });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url.indexOf(url) !== -1 && 'focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
`;

module.exports = function (app) {
  const send = (admin) => (req, res) => { res.type('application/manifest+json').set('Cache-Control', 'no-cache').send(JSON.stringify(manifest(admin))); };
  app.get('/manifest-user.webmanifest', send(false));
  app.get('/manifest-admin.webmanifest', send(true));
  app.get('/manifest.webmanifest', send(false));
  app.get('/icons/:file', (req, res, next) => {
    const m = /^(.+)\.png$/.exec(req.params.file);
    const buf = m && icon(m[1]);
    if (!buf) return next();
    res.type('image/png').set('Cache-Control', 'public, max-age=86400').send(buf);
  });
  app.get('/favicon.ico', (req, res) => res.type('image/png').set('Cache-Control', 'public, max-age=86400').send(icon('favicon-48')));
  app.get('/sw.js', (req, res) => res.type('application/javascript').set({ 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' }).send(SW));
  setImmediate(() => { try { icon('icon-192'); icon('icon-512'); } catch (e) { console.error('icon warm-up failed', e.message); } });
};
module.exports._icon = icon;
