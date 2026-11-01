const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { isLogin } = require('../middleware/auth');
const { unggahAvatar, hapusAvatar } = require('../middleware/avatar');

const router = express.Router();
router.use(isLogin);

const ambil = (id) => db.one('SELECT id, nama, email, role, avatar, telepon, alamat, created_at FROM users WHERE id = ?', [id]);

router.get('/', async (req, res) =>
  res.render('profil', { title: 'Profil saya', u: await ambil(req.session.user.id), error: null }));

// Ubah nama, nomor HP, alamat, dan foto avatar
router.post('/', unggahAvatar, async (req, res) => {
  const lama = await ambil(req.session.user.id);
  const nama = (req.body.nama || '').trim();
  const telepon = (req.body.telepon || '').trim();
  const alamat = (req.body.alamat || '').trim();
  const gagal = (error) => {
    if (req.file) hapusAvatar(req.file.filename);
    res.status(400).render('profil', { title: 'Profil saya', u: { ...lama, nama, telepon, alamat }, error });
  };
  if (req.uploadError) return gagal(req.uploadError);
  if (nama.length < 2) return gagal('Nama minimal 2 karakter.');
  if (telepon && !/^[0-9+\-\s]{8,20}$/.test(telepon)) return gagal('Nomor HP belum benar (8 sampai 20 angka).');
  if (alamat && alamat.length < 10) return gagal('Alamat minimal 10 karakter (jalan, nomor, kota).');

  const avatar = req.file ? req.file.filename : lama.avatar;
  await db.query('UPDATE users SET nama = ?, telepon = ?, alamat = ?, avatar = ? WHERE id = ?',
    [nama, telepon || null, alamat || null, avatar, lama.id]);
  if (req.file) hapusAvatar(lama.avatar);
  req.session.flash = { type: 'success', text: 'Profil diperbarui.' };
  res.redirect('/profil');
});

router.post('/avatar/hapus', async (req, res) => {
  const lama = await ambil(req.session.user.id);
  await db.query('UPDATE users SET avatar = NULL WHERE id = ?', [lama.id]);
  hapusAvatar(lama.avatar);
  req.session.flash = { type: 'success', text: 'Foto avatar dihapus.' };
  res.redirect('/profil');
});

// Ubah password sendiri
router.post('/password', async (req, res) => {
  const { lama = '', baru = '', konfirmasi = '' } = req.body;
  const kembali = (type, text) => { req.session.flash = { type, text }; res.redirect('/profil'); };
  const u = await db.one('SELECT password FROM users WHERE id = ?', [req.session.user.id]);
  if (!(await bcrypt.compare(lama, u.password))) return kembali('danger', 'Password lama salah.');
  if (baru.length < 6) return kembali('danger', 'Password baru minimal 6 karakter.');
  if (baru !== konfirmasi) return kembali('danger', 'Konfirmasi password baru tidak sama.');
  await db.query('UPDATE users SET password = ? WHERE id = ?', [await bcrypt.hash(baru, 10), req.session.user.id]);
  kembali('success', 'Password berhasil diubah.');
});

module.exports = router;
