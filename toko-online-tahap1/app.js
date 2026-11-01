require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./config');
const db = require('./db');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.toko = require('./info-toko');
app.locals.rupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
app.locals.statusLabel = (s) => config.status[s] || s;
app.locals.tanggal = (t) => new Date(String(t).replace(' ', 'T'))
  .toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'ganti-rahasia-ini',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

// Pastikan akun masih aktif dan data (nama, peran, avatar) selalu terbaru
app.use(async (req, res, next) => {
  const s = req.session.user;
  if (s) {
    const u = await db.one('SELECT nama, role, status, avatar FROM users WHERE id = ?', [s.id]);
    if (!u || u.status !== 'aktif') return req.session.destroy(() => res.redirect('/login'));
    s.nama = u.nama; s.role = u.role; s.avatar = u.avatar;
  }
  next();
});

// Data yang tersedia di semua halaman
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  res.locals.cartCount = Object.values(req.session.cart || {}).reduce((a, b) => a + b, 0);
  delete req.session.flash;
  next();
});

app.get('/', async (req, res) => {
  const produk = await db.query(`SELECT p.*,
    (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE product_id = p.id) AS rata,
    (SELECT COUNT(*) FROM reviews WHERE product_id = p.id) AS jml
    FROM products p ORDER BY p.id DESC LIMIT 8`);
  res.render('index', { title: null, produk });
});
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/produk'));
app.use('/', require('./routes/keranjang'));
app.use('/pesanan', require('./routes/pesanan'));
app.use('/profil', require('./routes/profil'));
app.use('/admin', require('./routes/admin'));
app.use('/admin', require('./routes/admin-pesanan'));
app.use('/admin', require('./routes/admin-pengguna'));
app.use('/admin', require('./routes/admin-laporan'));

app.use((req, res) => res.status(404).render('404', { title: 'Tidak ditemukan' }));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  db.siap
    .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Toko berjalan di http://localhost:${PORT}`)))
    .catch((e) => { console.error('Gagal terhubung ke database:', e.message); process.exit(1); });
}
module.exports = app;
