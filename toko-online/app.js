// app.js
const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db'); // Menghubungkan ke db.js di root

const app = express();

// Konfigurasi View Engine EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware Dasar
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Konfigurasi Session untuk Login
app.use(session({
  secret: 'rahasia_toko_online_super_aman',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // Sesi aktif selama 1 hari
}));

// Variabel Global EJS agar status user bisa diakses di semua halaman
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// ==========================================
// 1. DEKLARASI / IMPORT ROUTER (WAJIB DI ATAS)
// ==========================================
const authRouter = require('./routes/auth');
const produkRouter = require('./routes/produk');
const keranjangRouter = require('./routes/keranjang');
const orderRouter = require('./routes/order');
const adminRouter = require('./routes/admin'); // <-- Pastikan ini ada dan namanya sesuai

// ==========================================
// 2. REGISTRASI RUTE KE EXPRESS
// ==========================================
app.use('/auth', authRouter);
app.use('/produk', produkRouter);
app.use('/keranjang', keranjangRouter);
app.use('/order', orderRouter);
app.use('/admin', adminRouter);

// Rute Halaman Utama (Mengarah ke Katalog)
app.get('/', (req, res) => {
  res.redirect('/produk');
});

// Menjalankan Server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` Server Toko Online Berhasil Berjalan!`);
  console.log(` Akses lokal via Laptop: http://localhost:${PORT}`);
  console.log(`===================================================`);
});
