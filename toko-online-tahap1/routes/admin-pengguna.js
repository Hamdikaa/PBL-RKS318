const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { isAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(isAdmin); // hanya admin yang boleh mengelola pengguna (seller tidak bisa)

const cari = (id) => db.one('SELECT id, nama, email, role, status, created_at FROM users WHERE id = ?', [id]);
const dirinya = (req) => Number(req.params.id) === req.session.user.id;
const tidakAda = (res) => res.status(404).render('404', { title: 'Tidak ditemukan' });
function tolakDiri(req, res) {
  req.session.flash = { type: 'warning', text: 'Anda tidak dapat mengubah akun Anda sendiri dari sini.' };
  res.redirect(`/admin/pengguna/${req.params.id}`);
}

router.get('/pengguna', async (req, res) => {
  const q = (req.query.q || '').trim();
  const pengguna = await db.query(`SELECT u.*, (SELECT COUNT(*) FROM orders WHERE user_id = u.id) AS pesanan
    FROM users u WHERE u.nama LIKE ? OR u.email LIKE ? ORDER BY u.id`, ['%' + q + '%', '%' + q + '%']);
  res.render('admin/pengguna', { title: 'Kelola pengguna', pengguna, q });
});

router.get('/pengguna/:id', async (req, res) => {
  const u = await cari(req.params.id);
  if (!u) return tidakAda(res);
  const pesanan = (await db.one('SELECT COUNT(*) AS n FROM orders WHERE user_id = ?', [u.id])).n;
  res.render('admin/pengguna-detail', { title: u.nama, u, pesanan, diri: dirinya(req) });
});

router.post('/pengguna/:id/status', async (req, res) => {
  const u = await cari(req.params.id);
  if (!u) return tidakAda(res);
  if (dirinya(req)) return tolakDiri(req, res);
  const baru = u.status === 'aktif' ? 'nonaktif' : 'aktif';
  await db.query('UPDATE users SET status = ? WHERE id = ?', [baru, u.id]);
  req.session.flash = { type: 'success', text: `Akun ${u.nama} sekarang ${baru}.` };
  res.redirect(`/admin/pengguna/${u.id}`);
});

router.post('/pengguna/:id/role', async (req, res) => {
  const u = await cari(req.params.id);
  if (!u) return tidakAda(res);
  if (dirinya(req)) return tolakDiri(req, res);
  const role = ['admin', 'seller'].includes(req.body.role) ? req.body.role : 'customer';
  await db.query('UPDATE users SET role = ? WHERE id = ?', [role, u.id]);
  req.session.flash = { type: 'success', text: `Peran ${u.nama} diubah menjadi ${role}.` };
  res.redirect(`/admin/pengguna/${u.id}`);
});

router.post('/pengguna/:id/reset', async (req, res) => {
  const u = await cari(req.params.id);
  if (!u) return tidakAda(res);
  const pw = req.body.password || '';
  if (pw.length < 6) {
    req.session.flash = { type: 'danger', text: 'Password baru minimal 6 karakter.' };
    return res.redirect(`/admin/pengguna/${u.id}`);
  }
  await db.query('UPDATE users SET password = ? WHERE id = ?', [await bcrypt.hash(pw, 10), u.id]);
  req.session.flash = { type: 'success', text: `Password ${u.nama} berhasil direset. Sampaikan password baru kepada pemilik akun.` };
  res.redirect(`/admin/pengguna/${u.id}`);
});

module.exports = router;
