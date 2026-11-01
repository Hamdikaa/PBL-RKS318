const express = require('express');
const db = require('../db');
const config = require('../config');
const { isStaff } = require('../middleware/auth');

const router = express.Router();
router.use(isStaff); // admin dan seller

const kurirNama = (kode) => (config.kurir.find((k) => k.kode === kode) || {}).nama || kode || '-';
const tidakAda = (res) => res.status(404).render('404', { title: 'Tidak ditemukan' });

// Hak akses: admin boleh semuanya. Seller boleh melihat pesanan yang berisi produknya,
// tetapi hanya boleh memproses pesanan yang SEMUA isinya produk miliknya.
async function hak(req, orderId) {
  const u = req.session.user;
  if (u.role === 'admin') return { lihat: true, kelola: true };
  const r = await db.one(`SELECT COUNT(*) AS total, SUM(p.seller_id = ?) AS milik
    FROM order_items i JOIN products p ON p.id = i.product_id WHERE i.order_id = ?`, [u.id, orderId]);
  const milik = Number(r.milik) || 0;
  return { lihat: milik > 0, kelola: milik > 0 && milik === r.total };
}

// Daftar pesanan (menunggu verifikasi dan siap kirim tampil paling atas)
router.get('/pesanan', async (req, res) => {
  const sesi = req.session.user;
  const status = Object.keys(config.status).includes(req.query.status) ? req.query.status : '';
  const where = [];
  const args = [];
  if (sesi.role !== 'admin') {
    where.push(`EXISTS (SELECT 1 FROM order_items i JOIN products p ON p.id = i.product_id
      WHERE i.order_id = o.id AND p.seller_id = ?)`);
    args.push(sesi.id);
  }
  if (status) { where.push('o.status = ?'); args.push(status); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const pesanan = await db.query(`SELECT o.*, u.nama AS pelanggan FROM orders o JOIN users u ON u.id = o.user_id ${w}
    ORDER BY CASE o.status WHEN 'menunggu_verifikasi' THEN 0 WHEN 'disetujui' THEN 1 ELSE 2 END, o.id DESC`, args);
  res.render('admin/pesanan', { title: 'Pesanan masuk', pesanan, status, semuaStatus: config.status });
});

router.get('/pesanan/:id', async (req, res) => {
  const o = await db.one(`SELECT o.*, u.nama AS pelanggan, u.email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?`, [req.params.id]);
  const h = o ? await hak(req, o.id) : null;
  if (!o || !h.lihat) return tidakAda(res);
  const items = await db.query(`SELECT i.*, p.nama, p.seller_id FROM order_items i JOIN products p ON p.id = i.product_id WHERE i.order_id = ?`, [o.id]);
  res.render('admin/pesanan-detail', { title: `Pesanan #${o.id}`, o, items, kelola: h.kelola, kurirNama: kurirNama(o.kurir) });
});

// Ubah status pesanan: dari status tertentu ke status baru (kirim butuh nomor resi)
const ubah = (dari, ke, pesan, butuhResi = false) => async (req, res) => {
  const o = await db.one('SELECT id, status FROM orders WHERE id = ?', [req.params.id]);
  if (!o) return tidakAda(res);
  const balik = (type, text) => { req.session.flash = { type, text }; res.redirect(`/admin/pesanan/${o.id}`); };
  if (!(await hak(req, o.id)).kelola) return balik('danger', 'Anda tidak berwenang memproses pesanan ini.');
  if (o.status !== dari) return balik('warning', 'Status pesanan sudah berubah. Muat ulang halaman.');
  if (butuhResi) {
    const resi = (req.body.resi || '').trim();
    if (resi.length < 4 || resi.length > 60) return balik('danger', 'Isi nomor resi (minimal 4 karakter).');
    await db.query('UPDATE orders SET status = ?, resi = ? WHERE id = ?', [ke, resi, o.id]);
  } else {
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [ke, o.id]);
  }
  balik('success', pesan);
};
router.post('/pesanan/:id/setujui', ubah('menunggu_verifikasi', 'disetujui', 'Pembayaran disetujui.'));
router.post('/pesanan/:id/tolak', ubah('menunggu_verifikasi', 'ditolak', 'Bukti ditolak. Pelanggan dapat mengunggah ulang.'));
router.post('/pesanan/:id/kirim', ubah('disetujui', 'dikirim', 'Pesanan ditandai dikirim.', true));

module.exports = router;
