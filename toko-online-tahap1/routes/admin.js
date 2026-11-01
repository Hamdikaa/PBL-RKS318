const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { isStaff } = require('../middleware/auth');

const router = express.Router();
router.use(isStaff); // admin dan seller; halaman admin lain memakai isAdmin sendiri

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) =>
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname).toLowerCase())
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp)$/.test(file.mimetype);
    cb(ok ? null : new Error('TIPE'), ok);
  }
});
const unggah = (req, res, next) =>
  upload.single('gambar')(req, res, (err) => {
    if (err) {
      req.uploadError = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran foto maksimal 2 MB.'
        : err.message === 'TIPE' ? 'Foto harus berformat JPG, PNG, atau WEBP.' : 'Foto gagal diunggah.';
    }
    next();
  });
const hapusFile = (nama) => { if (nama) fs.unlink(path.join(UPLOAD_DIR, nama), () => {}); };

const daftarKategori = async () => (await db.query("SELECT DISTINCT kategori FROM products WHERE kategori <> '' ORDER BY kategori"))
  .map((r) => r.kategori);

// Produk hanya boleh dikelola pemiliknya (seller) atau admin
async function ambilProduk(req) {
  const p = await db.one('SELECT * FROM products WHERE id = ?', [req.params.id]);
  const u = req.session.user;
  return p && (u.role === 'admin' || p.seller_id === u.id) ? p : null;
}
const tidakAda = (res) => res.status(404).render('404', { title: 'Tidak ditemukan' });

function baca(req) {
  const b = req.body;
  return {
    nama: (b.nama || '').trim(), deskripsi: (b.deskripsi || '').trim(), kategori: (b.kategori || '').trim(),
    harga: Number(b.harga), stok: Number(b.stok || 0)
  };
}
function periksa(p, uploadError) {
  if (uploadError) return uploadError;
  if (p.nama.length < 2) return 'Nama produk minimal 2 karakter.';
  if (!Number.isInteger(p.harga) || p.harga < 1) return 'Harga harus angka bulat, minimal 1.';
  if (!Number.isInteger(p.stok) || p.stok < 0) return 'Stok harus angka bulat, 0 atau lebih.';
  return null;
}
const formView = async (res, status, data) =>
  res.status(status).render('admin/form', { kategori: await daftarKategori(), ...data });

// Dashboard (admin: ringkasan toko, seller: ringkasan produk sendiri)
router.get('/', async (req, res) => {
  const u = req.session.user;
  const n = async (sql, a = []) => (await db.one(sql, a)).n;
  const stat = u.role === 'admin'
    ? {
        produk: await n('SELECT COUNT(*) AS n FROM products'),
        pesanan: await n('SELECT COUNT(*) AS n FROM orders'),
        verifikasi: await n("SELECT COUNT(*) AS n FROM orders WHERE status = 'menunggu_verifikasi'"),
        pengguna: await n("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'")
      }
    : {
        produk: await n('SELECT COUNT(*) AS n FROM products WHERE seller_id = ?', [u.id]),
        habis: await n('SELECT COUNT(*) AS n FROM products WHERE seller_id = ? AND stok = 0', [u.id]),
        verifikasi: await n(`SELECT COUNT(DISTINCT o.id) AS n FROM orders o JOIN order_items i ON i.order_id = o.id
          JOIN products p ON p.id = i.product_id WHERE p.seller_id = ? AND o.status = 'menunggu_verifikasi'`, [u.id])
      };
  res.render('admin/dashboard', { title: u.role === 'admin' ? 'Dashboard admin' : 'Dashboard penjual', stat });
});

// Daftar produk
router.get('/produk', async (req, res) => {
  const u = req.session.user;
  const produk = await db.query(`SELECT p.*, s.nama AS penjual FROM products p LEFT JOIN users s ON s.id = p.seller_id
    ${u.role === 'admin' ? '' : 'WHERE p.seller_id = ?'} ORDER BY p.id DESC`, u.role === 'admin' ? [] : [u.id]);
  res.render('admin/produk', { title: 'Kelola produk', produk });
});

// Tambah
router.get('/produk/baru', async (req, res) =>
  formView(res, 200, { title: 'Tambah produk', judul: 'Tambah produk', aksi: '/admin/produk', produk: {}, error: null }));

router.post('/produk', unggah, async (req, res) => {
  const p = baca(req);
  const error = periksa(p, req.uploadError);
  if (error) {
    if (req.file) hapusFile(req.file.filename);
    return formView(res, 400, { title: 'Tambah produk', judul: 'Tambah produk', aksi: '/admin/produk', produk: p, error });
  }
  await db.query('INSERT INTO products (seller_id, nama, deskripsi, harga, stok, kategori, gambar) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.session.user.id, p.nama, p.deskripsi, p.harga, p.stok, p.kategori, req.file ? req.file.filename : null]);
  req.session.flash = { type: 'success', text: 'Produk berhasil ditambahkan.' };
  res.redirect('/admin/produk');
});

// Ubah
router.get('/produk/:id/edit', async (req, res) => {
  const produk = await ambilProduk(req);
  if (!produk) return tidakAda(res);
  formView(res, 200, { title: 'Ubah produk', judul: 'Ubah produk', aksi: `/admin/produk/${produk.id}`, produk, error: null });
});

router.post('/produk/:id', unggah, async (req, res) => {
  const lama = await ambilProduk(req);
  if (!lama) { if (req.file) hapusFile(req.file.filename); return tidakAda(res); }
  const p = baca(req);
  const error = periksa(p, req.uploadError);
  if (error) {
    if (req.file) hapusFile(req.file.filename);
    return formView(res, 400, {
      title: 'Ubah produk', judul: 'Ubah produk', aksi: `/admin/produk/${lama.id}`,
      produk: { ...p, id: lama.id, gambar: lama.gambar }, error
    });
  }
  const gambar = req.file ? req.file.filename : lama.gambar;
  await db.query('UPDATE products SET nama = ?, deskripsi = ?, harga = ?, stok = ?, kategori = ?, gambar = ? WHERE id = ?',
    [p.nama, p.deskripsi, p.harga, p.stok, p.kategori, gambar, lama.id]);
  if (req.file) hapusFile(lama.gambar);
  req.session.flash = { type: 'success', text: 'Perubahan produk disimpan.' };
  res.redirect('/admin/produk');
});

// Hapus
router.post('/produk/:id/hapus', async (req, res) => {
  const lama = await ambilProduk(req);
  if (!lama) return tidakAda(res);
  try {
    await db.query('DELETE FROM products WHERE id = ?', [lama.id]);
    hapusFile(lama.gambar);
    req.session.flash = { type: 'success', text: 'Produk dihapus.' };
  } catch (e) {
    if (e.code !== 'ER_ROW_IS_REFERENCED_2') throw e;
    req.session.flash = { type: 'danger', text: 'Produk ini sudah pernah dipesan, jadi tidak bisa dihapus. Ubah stoknya menjadi 0.' };
  }
  res.redirect('/admin/produk');
});

module.exports = router;
