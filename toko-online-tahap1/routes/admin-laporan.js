const express = require('express');
const db = require('../db');
const config = require('../config');
const { isAdmin } = require('../middleware/auth');

const router = express.Router();
const LUNAS = ['disetujui', 'dikirim', 'selesai'];
router.use(isAdmin);

// Baca filter dari URL (tanggal dan status). Bawaan: status disetujui.
function saring(q) {
  const tgl = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
  const dari = tgl(q.dari);
  const sampai = tgl(q.sampai);
  const status = q.status === undefined ? 'lunas' : (q.status === 'lunas' || Object.keys(config.status).includes(q.status) ? q.status : '');
  const where = [];
  const args = [];
  if (dari) { where.push('DATE(o.created_at) >= ?'); args.push(dari); }
  if (sampai) { where.push('DATE(o.created_at) <= ?'); args.push(sampai); }
  if (status === 'lunas') where.push("o.status IN ('disetujui', 'dikirim', 'selesai')");
  else if (status) { where.push('o.status = ?'); args.push(status); }
  return { dari, sampai, status, w: where.length ? 'WHERE ' + where.join(' AND ') : '', args };
}

const ambilPesanan = (f) => db.query(`SELECT o.*, u.nama AS pelanggan, u.email FROM orders o
  JOIN users u ON u.id = o.user_id ${f.w} ORDER BY o.id DESC`, f.args);

router.get('/laporan', async (req, res) => {
  const f = saring(req.query);
  const pesanan = await ambilPesanan(f);
  const lunas = pesanan.filter((o) => LUNAS.includes(o.status));
  const omzet = lunas.reduce((a, o) => a + o.total - o.ongkir, 0);
  const ongkir = lunas.reduce((a, o) => a + o.ongkir, 0);
  const and = f.w ? f.w + " AND o.status IN ('disetujui', 'dikirim', 'selesai')" : "WHERE o.status IN ('disetujui', 'dikirim', 'selesai')";
  const terlaris = await db.query(`SELECT p.nama, SUM(i.qty) AS qty, SUM(i.qty * i.harga) AS pendapatan
    FROM order_items i JOIN orders o ON o.id = i.order_id JOIN products p ON p.id = i.product_id
    ${and} GROUP BY p.id ORDER BY qty DESC LIMIT 5`, f.args);
  const query = new URLSearchParams({ dari: f.dari, sampai: f.sampai, status: f.status }).toString();
  res.render('admin/laporan', { title: 'Laporan transaksi', f, pesanan, omzet, ongkir, terlaris, query, semuaStatus: config.status });
});

// Unduh CSV (dibuka di Excel). Sel yang diawali = + - @ diberi tanda ' agar aman dari formula injection.
router.get('/laporan.csv', async (req, res) => {
  const f = saring(req.query);
  const sel = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const baris = [['No', 'Tanggal', 'Pelanggan', 'Email', 'Total', 'Ongkir', 'Status']];
  (await ambilPesanan(f)).forEach((o) => baris.push([o.id, o.created_at, o.pelanggan, o.email, o.total, o.ongkir, config.status[o.status]]));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="laporan-transaksi.csv"');
  res.send('\uFEFF' + baris.map((r) => r.map(sel).join(';')).join('\r\n'));
});

module.exports = router;
