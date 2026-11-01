const express = require('express');
const db = require('../db');
const { isLogin, isAdmin } = require('../middleware/auth');

const router = express.Router();

router.use((req, res, next) => {
  res.locals.bintang = (n) => { const b = Math.round(n || 0); return '★'.repeat(b) + '☆'.repeat(5 - b); };
  next();
});

// Produk + nama penjual + rata-rata rating + jumlah ulasan
const DAFTAR = `SELECT p.*, u.nama AS penjual,
  (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE product_id = p.id) AS rata,
  (SELECT COUNT(*) FROM reviews WHERE product_id = p.id) AS jml
  FROM products p LEFT JOIN users u ON u.id = p.seller_id`;

const URUT = {
  terbaru: 'p.id DESC',
  termurah: 'p.harga ASC, p.id DESC',
  termahal: 'p.harga DESC, p.id DESC',
  rating: 'COALESCE(rata, 0) DESC, jml DESC, p.id DESC'
};

// Katalog: cari nama, filter kategori, filter harga, urutkan
router.get('/produk', async (req, res) => {
  const q = (req.query.q || '').trim();
  const kat = (req.query.kategori || '').trim();
  const angka = (v) => { const n = parseInt(v, 10); return Number.isInteger(n) && n >= 0 ? n : null; };
  const min = angka(req.query.min);
  const max = angka(req.query.max);
  const urut = URUT[req.query.urut] ? req.query.urut : 'terbaru';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const per = 12;

  const where = [];
  const args = [];
  if (q) { where.push('p.nama LIKE ?'); args.push('%' + q + '%'); }
  if (kat) { where.push('p.kategori = ?'); args.push(kat); }
  if (min !== null) { where.push('p.harga >= ?'); args.push(min); }
  if (max !== null) { where.push('p.harga <= ?'); args.push(max); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = (await db.one(`SELECT COUNT(*) AS n FROM products p ${w}`, args)).n;
  const produk = await db.query(`${DAFTAR} ${w} ORDER BY ${URUT[urut]} LIMIT ? OFFSET ?`, [...args, per, (page - 1) * per]);
  const kategori = (await db.query("SELECT DISTINCT kategori FROM products WHERE kategori <> '' ORDER BY kategori"))
    .map((r) => r.kategori);

  res.render('produk/katalog', {
    title: 'Produk', produk, kategori, q, kat, min: min ?? '', max: max ?? '', urut, page, total,
    halaman: Math.max(1, Math.ceil(total / per))
  });
});

// Detail produk + ulasan
router.get('/produk/:id', async (req, res) => {
  const p = await db.one(`${DAFTAR} WHERE p.id = ?`, [req.params.id]);
  if (!p) return res.status(404).render('404', { title: 'Tidak ditemukan' });
  const ulasan = await db.query(`SELECT r.*, u.nama FROM reviews r JOIN users u ON u.id = r.user_id
    WHERE r.product_id = ? ORDER BY r.id DESC`, [p.id]);
  const milik = req.session.user ? ulasan.find((r) => r.user_id === req.session.user.id) : null;
  res.render('produk/detail', { title: p.nama, p, ulasan, milik });
});

// Kirim atau ubah ulasan (satu akun, satu ulasan per produk)
router.post('/produk/:id/ulasan', isLogin, async (req, res) => {
  const p = await db.one('SELECT id FROM products WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).render('404', { title: 'Tidak ditemukan' });
  const kembali = `/produk/${p.id}#ulasan`;
  const u = req.session.user;

  if (u.role === 'admin') {
    req.session.flash = { type: 'warning', text: 'Akun admin tidak bisa memberi ulasan.' };
    return res.redirect(kembali);
  }
  const rating = parseInt(req.body.rating, 10);
  const komentar = (req.body.komentar || '').trim().slice(0, 500);
  if (!(rating >= 1 && rating <= 5)) {
    req.session.flash = { type: 'danger', text: 'Pilih rating 1 sampai 5 bintang.' };
    return res.redirect(kembali);
  }
  const ada = await db.one('SELECT id FROM reviews WHERE product_id = ? AND user_id = ?', [p.id, u.id]);
  if (ada) {
    await db.query('UPDATE reviews SET rating = ?, komentar = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?', [rating, komentar, ada.id]);
  } else {
    await db.query('INSERT INTO reviews (product_id, user_id, rating, komentar) VALUES (?, ?, ?, ?)', [p.id, u.id, rating, komentar]);
  }
  req.session.flash = { type: 'success', text: ada ? 'Ulasan Anda diperbarui.' : 'Terima kasih, ulasan Anda tersimpan.' };
  res.redirect(kembali);
});

// Admin menghapus ulasan
router.post('/produk/:id/ulasan/:rid/hapus', isAdmin, async (req, res) => {
  await db.query('DELETE FROM reviews WHERE id = ? AND product_id = ?', [req.params.rid, req.params.id]);
  req.session.flash = { type: 'success', text: 'Ulasan dihapus.' };
  res.redirect(`/produk/${req.params.id}#ulasan`);
});

module.exports = router;
