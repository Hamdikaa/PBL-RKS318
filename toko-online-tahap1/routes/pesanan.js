const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const config = require('../config');
const { isLogin } = require('../middleware/auth');

const router = express.Router();
router.use(isLogin);

// Bukti bayar disimpan di folder "bukti" (tidak publik), hanya bisa dibuka lewat route di bawah
const DIR = path.join(__dirname, '..', 'bukti');
fs.mkdirSync(DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: DIR,
    filename: (req, file, cb) =>
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname).toLowerCase())
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp)$/.test(file.mimetype);
    cb(ok ? null : new Error('TIPE'), ok);
  }
});
const unggah = (req, res, next) =>
  upload.single('bukti')(req, res, (err) => {
    if (err) {
      req.uploadError = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran foto maksimal 3 MB.'
        : err.message === 'TIPE' ? 'Foto harus berformat JPG, PNG, atau WEBP.' : 'Foto gagal diunggah.';
    }
    next();
  });
const hapusFile = (n) => { if (n) fs.unlink(path.join(DIR, n), () => {}); };

// Ambil pesanan: pemilik, admin, atau seller yang produknya ada di pesanan
async function ambil(req) {
  const o = await db.one('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!o) return null;
  const u = req.session.user;
  if (o.user_id === u.id || u.role === 'admin') return o;
  if (u.role === 'seller') {
    const ada = await db.one(`SELECT 1 AS ada FROM order_items i JOIN products p ON p.id = i.product_id
      WHERE i.order_id = ? AND p.seller_id = ? LIMIT 1`, [o.id, u.id]);
    if (ada) return o;
  }
  return null;
}
const kurirNama = (kode) => (config.kurir.find((k) => k.kode === kode) || {}).nama || kode || '-';
const tidakAda = (res) => res.status(404).render('404', { title: 'Tidak ditemukan' });

// Riwayat pesanan
router.get('/', async (req, res) => {
  const pesanan = await db.query(`SELECT o.*, (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) AS jml
    FROM orders o WHERE o.user_id = ? ORDER BY o.id DESC`, [req.session.user.id]);
  res.render('pesanan/riwayat', { title: 'Pesanan saya', pesanan });
});

// Detail pesanan
router.get('/:id', async (req, res) => {
  const o = await ambil(req);
  if (!o) return tidakAda(res);
  const items = await db.query(`SELECT i.*, p.nama, p.gambar FROM order_items i
    JOIN products p ON p.id = i.product_id WHERE i.order_id = ?`, [o.id]);
  res.render('pesanan/detail', { title: `Pesanan #${o.id}`, o, items, bank: config.bank, kurirNama: kurirNama(o.kurir) });
});

// Tampilkan foto bukti bayar (hanya pemilik dan admin)
router.get('/:id/bukti', async (req, res) => {
  const o = await ambil(req);
  if (!o || !o.bukti_bayar) return tidakAda(res);
  res.sendFile(path.join(DIR, o.bukti_bayar));
});

// Unggah bukti bayar
router.post('/:id/bukti', unggah, async (req, res) => {
  const o = await ambil(req);
  const kembali = `/pesanan/${req.params.id}`;
  const gagal = (text) => {
    if (req.file) hapusFile(req.file.filename);
    req.session.flash = { type: 'danger', text };
    res.redirect(kembali);
  };
  if (!o || o.user_id !== req.session.user.id) { if (req.file) hapusFile(req.file.filename); return tidakAda(res); }
  if (!['menunggu_bayar', 'ditolak'].includes(o.status)) return gagal('Bukti pembayaran tidak bisa diunggah pada status ini.');
  if (req.uploadError) return gagal(req.uploadError);
  if (!req.file) return gagal('Pilih foto bukti transfer terlebih dahulu.');

  await db.query("UPDATE orders SET bukti_bayar = ?, status = 'menunggu_verifikasi' WHERE id = ?", [req.file.filename, o.id]);
  hapusFile(o.bukti_bayar);
  req.session.flash = { type: 'success', text: 'Bukti pembayaran terkirim. Admin akan memeriksanya.' };
  res.redirect(kembali);
});

// Batalkan pesanan (stok dikembalikan)
const batalkan = (id) => db.tx(async (q) => {
  const items = await q('SELECT product_id, qty FROM order_items WHERE order_id = ?', [id]);
  for (const i of items) await q('UPDATE products SET stok = stok + ? WHERE id = ?', [i.qty, i.product_id]);
  await q("UPDATE orders SET status = 'dibatalkan' WHERE id = ?", [id]);
});
router.post('/:id/batal', async (req, res) => {
  const o = await ambil(req);
  if (!o || o.user_id !== req.session.user.id) return tidakAda(res);
  if (['menunggu_bayar', 'ditolak'].includes(o.status)) {
    await batalkan(o.id);
    req.session.flash = { type: 'success', text: 'Pesanan dibatalkan.' };
  }
  res.redirect(`/pesanan/${o.id}`);
});

// Customer mengonfirmasi barang sudah diterima
router.post('/:id/selesai', async (req, res) => {
  const o = await ambil(req);
  if (!o || o.user_id !== req.session.user.id) return tidakAda(res);
  if (o.status === 'dikirim') {
    await db.query("UPDATE orders SET status = 'selesai' WHERE id = ?", [o.id]);
    req.session.flash = { type: 'success', text: 'Terima kasih! Pesanan ditandai selesai.' };
  }
  res.redirect(`/pesanan/${o.id}`);
});

module.exports = router;
