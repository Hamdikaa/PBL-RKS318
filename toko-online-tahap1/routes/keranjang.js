const express = require('express');
const db = require('../db');
const config = require('../config');
const { isLogin } = require('../middleware/auth');

const router = express.Router();

const pembeli = (req, res, next) => {
  if (req.session.user.role === 'admin') {
    req.session.flash = { type: 'warning', text: 'Akun admin tidak dipakai untuk belanja.' };
    return res.redirect('/');
  }
  next();
};

// Baca keranjang dari session, sesuaikan dengan data produk dan stok terbaru
async function muat(req) {
  const cart = req.session.cart || {};
  const items = [];
  const baru = {};
  let total = 0;
  for (const [id, qty] of Object.entries(cart)) {
    const p = await db.one('SELECT * FROM products WHERE id = ?', [id]);
    if (!p || p.stok <= 0) continue;
    const q = Math.min(qty, p.stok);
    baru[id] = q;
    total += p.harga * q;
    items.push({ p, qty: q, sub: p.harga * q });
  }
  req.session.cart = baru;
  return { items, total };
}

router.get('/keranjang', isLogin, pembeli, async (req, res) =>
  res.render('keranjang', { title: 'Keranjang', ...(await muat(req)) }));

router.post('/keranjang/tambah/:id', isLogin, pembeli, async (req, res) => {
  const p = await db.one('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).render('404', { title: 'Tidak ditemukan' });
  if (p.stok <= 0) {
    req.session.flash = { type: 'danger', text: 'Maaf, stok produk ini habis.' };
    return res.redirect(`/produk/${p.id}`);
  }
  const qty = Math.max(1, parseInt(req.body.qty, 10) || 1);
  const cart = req.session.cart || (req.session.cart = {});
  const diminta = (cart[p.id] || 0) + qty;
  cart[p.id] = Math.min(diminta, p.stok);
  req.session.flash = diminta > p.stok
    ? { type: 'warning', text: `Jumlah disesuaikan dengan stok yang ada (${p.stok}).` }
    : { type: 'success', text: 'Produk ditambahkan ke keranjang.' };
  res.redirect('/keranjang');
});

router.post('/keranjang/ubah/:id', isLogin, pembeli, async (req, res) => {
  const p = await db.one('SELECT stok FROM products WHERE id = ?', [req.params.id]);
  const qty = parseInt(req.body.qty, 10) || 0;
  const cart = req.session.cart || (req.session.cart = {});
  if (!p || qty <= 0) delete cart[req.params.id];
  else cart[req.params.id] = Math.min(qty, p.stok);
  res.redirect('/keranjang');
});

router.post('/keranjang/hapus/:id', isLogin, pembeli, (req, res) => {
  if (req.session.cart) delete req.session.cart[req.params.id];
  res.redirect('/keranjang');
});

const bacaForm = (b) => ({
  penerima: (b.penerima || '').trim(), telepon: (b.telepon || '').trim(),
  alamat: (b.alamat || '').trim(), kurir: b.kurir || ''
});
const tampilCheckout = (res, status, k, form, error) =>
  res.status(status).render('checkout', { title: 'Checkout', ...k, bank: config.bank, kurir: config.kurir, form, error });

router.get('/checkout', isLogin, pembeli, async (req, res) => {
  const k = await muat(req);
  if (!k.items.length) {
    req.session.flash = { type: 'warning', text: 'Keranjang Anda masih kosong.' };
    return res.redirect('/produk');
  }
  const u = await db.one('SELECT nama, telepon, alamat FROM users WHERE id = ?', [req.session.user.id]);
  tampilCheckout(res, 200, k, { penerima: u.nama, telepon: u.telepon || '', alamat: u.alamat || '', kurir: config.kurir[0].kode }, null);
});

// Buat pesanan: kunci baris produk, cek stok, simpan pesanan + alamat + ongkir, kurangi stok
const buatPesanan = (userId, items, info, kurir) => db.tx(async (q) => {
  const baris = [];
  for (const { p, qty } of items) {
    const row = (await q('SELECT id, nama, stok, harga FROM products WHERE id = ? FOR UPDATE', [p.id]))[0];
    if (!row || row.stok < qty) throw new Error('STOK:' + p.nama);
    baris.push({ row, qty });
  }
  const barang = baris.reduce((a, b) => a + b.row.harga * b.qty, 0);
  const oid = (await q(
    'INSERT INTO orders (user_id, total, ongkir, kurir, nama_penerima, telepon, alamat) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, barang + kurir.tarif, kurir.tarif, kurir.kode, info.penerima, info.telepon, info.alamat])).insertId;
  for (const { row, qty } of baris) {
    await q('INSERT INTO order_items (order_id, product_id, qty, harga) VALUES (?, ?, ?, ?)', [oid, row.id, qty, row.harga]);
    await q('UPDATE products SET stok = stok - ? WHERE id = ?', [qty, row.id]);
  }
  return oid;
});

router.post('/checkout', isLogin, pembeli, async (req, res) => {
  const k = await muat(req);
  if (!k.items.length) return res.redirect('/produk');
  const form = bacaForm(req.body);
  const kurir = config.kurir.find((x) => x.kode === form.kurir);
  const salah = (e) => tampilCheckout(res, 400, k, form, e);
  if (form.penerima.length < 2) return salah('Nama penerima minimal 2 karakter.');
  if (!/^[0-9+\-\s]{8,20}$/.test(form.telepon)) return salah('Nomor HP belum benar (8 sampai 20 angka).');
  if (form.alamat.length < 10) return salah('Alamat lengkap minimal 10 karakter (jalan, nomor, kota).');
  if (!kurir) return salah('Pilih layanan pengiriman.');
  try {
    const oid = await buatPesanan(req.session.user.id, k.items, form, kurir);
    req.session.cart = {};
    req.session.flash = { type: 'success', text: 'Pesanan dibuat. Silakan transfer lalu unggah bukti pembayaran.' };
    res.redirect(`/pesanan/${oid}`);
  } catch (e) {
    if (!String(e.message).startsWith('STOK:')) throw e;
    req.session.flash = { type: 'danger', text: `Stok "${e.message.slice(5)}" tidak mencukupi. Periksa keranjang Anda.` };
    res.redirect('/keranjang');
  }
});

module.exports = router;
