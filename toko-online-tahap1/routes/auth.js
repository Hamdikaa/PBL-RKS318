const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { guestOnly } = require('../middleware/auth');
const { unggahAvatar, hapusAvatar } = require('../middleware/avatar');

const router = express.Router();

router.get('/register', guestOnly, (req, res) =>
  res.render('auth/register', { title: 'Daftar', error: null, form: {} }));

// Daftar: nama, email, alamat, foto profil (opsional), password
router.post('/register', guestOnly, unggahAvatar, async (req, res) => {
  const nama = (req.body.nama || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const alamat = (req.body.alamat || '').trim();
  const password = req.body.password || '';
  const konfirmasi = req.body.konfirmasi || '';
  const tampilkan = (error) => {
    if (req.file) hapusAvatar(req.file.filename);
    return res.status(400).render('auth/register', { title: 'Daftar', error, form: { nama, email, alamat } });
  };

  if (req.uploadError) return tampilkan(req.uploadError);
  if (nama.length < 2) return tampilkan('Nama minimal 2 karakter.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return tampilkan('Format email belum benar.');
  if (alamat.length < 10) return tampilkan('Alamat minimal 10 karakter (jalan, nomor, kota).');
  if (password.length < 6) return tampilkan('Password minimal 6 karakter.');
  if (password !== konfirmasi) return tampilkan('Konfirmasi password tidak sama.');
  if (await db.one('SELECT id FROM users WHERE email = ?', [email]))
    return tampilkan('Email sudah terdaftar. Silakan masuk.');

  const hash = await bcrypt.hash(password, 10);
  try {
    await db.query('INSERT INTO users (nama, email, password, alamat, avatar) VALUES (?, ?, ?, ?, ?)',
      [nama, email, hash, alamat, req.file ? req.file.filename : null]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return tampilkan('Email sudah terdaftar. Silakan masuk.');
    throw e;
  }
  req.session.flash = { type: 'success', text: 'Akun berhasil dibuat. Silakan masuk.' };
  res.redirect('/login');
});

router.get('/login', guestOnly, (req, res) =>
  res.render('auth/login', { title: 'Masuk', error: null, form: {} }));

router.post('/login', guestOnly, async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const gagal = (error) =>
    res.status(401).render('auth/login', { title: 'Masuk', error, form: { email } });

  const u = await db.one('SELECT * FROM users WHERE email = ?', [email]);
  if (!u || !(await bcrypt.compare(password, u.password))) return gagal('Email atau password salah.');
  if (u.status !== 'aktif') return gagal('Akun Anda dinonaktifkan. Hubungi admin.');

  req.session.regenerate((err) => {
    if (err) return gagal('Terjadi kesalahan. Coba lagi.');
    req.session.user = { id: u.id, nama: u.nama, email: u.email, role: u.role, avatar: u.avatar };
    res.redirect('/');
  });
});

router.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

module.exports = router;
