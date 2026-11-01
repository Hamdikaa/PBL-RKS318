// routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Mengambil koneksi database dari root
const multer = require('multer');
const path = require('path');
const { checkAdmin } = require('../middleware/auth'); // Memastikan hanya admin yang bisa masuk

// --- Konfigurasi Multer untuk Upload Gambar Produk ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, 'prod-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Terapkan proteksi admin ke semua rute di bawah ini secara otomatis
router.use(checkAdmin);

// 1. Dashboard Ringkasan Admin
router.get('/dashboard', (req, res) => {
    // Menghitung total omzet pendapatan dari pesanan yang sukses (disetujui)
    const omzetData = db.prepare("SELECT SUM(total) as total FROM orders WHERE status = 'disetujui'").get();
    const totalOmzet = omzetData.total || 0;

    // Menghitung jumlah pesanan yang butuh verifikasi
    const pendingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'menunggu_verifikasi'").get().count;

    // Menghitung total produk jualan
    const totalProducts = db.prepare("SELECT COUNT(*) as count FROM products").get().count;

    res.render('admin/dashboard', { totalOmzet, pendingOrders, totalProducts });
});

// 2. Tampilan Manajemen Produk (CRUD)
router.get('/produk', (req, res) => {
    const products = db.prepare('SELECT * FROM products').all();
    res.render('admin/produk', { products });
});

// 3. Proses Tambah Produk Baru
router.post('/produk/add', upload.single('gambar'), (req, res) => {
    const { nama, deskripsi, harga, stok, kategori } = req.body;
    const gambar = req.file ? req.file.filename : null;

    try {
        const insert = db.prepare('INSERT INTO products (nama, deskripsi, harga, stok, kategori, gambar) VALUES (?, ?, ?, ?, ?, ?)');
        insert.run(nama, deskripsi, parseInt(harga), parseInt(stok), kategori, gambar);
        res.redirect('/admin/produk');
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal menambahkan produk baru.');
    }
});

// 4. Proses Hapus Produk
router.get('/produk/delete/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
        res.redirect('/admin/produk');
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal menghapus produk.');
    }
});

// 5. Tampilan Approval Pesanan Masuk
router.get('/pesanan', (req, res) => {
    // Mengambil semua order beserta nama pemesan
    const orders = db.prepare(`
        SELECT o.*, u.nama as nama_user 
        FROM orders o 
        JOIN users u ON o.user_id = u.id 
        ORDER BY o.tanggal DESC
    `).all();

    res.render('admin/pesanan', { orders });
});

// 6. Logika Proses Approval Bukti Bayar (Setujui / Tolak)
router.post('/pesanan/action/:id', (req, res) => {
    const orderId = req.params.id;
    const { tindakan } = req.body; // Isinya antara 'setujui' atau 'tolak'

    try {
        if (tindakan === 'setujui') {
            db.prepare("UPDATE orders SET status = 'disetujui' WHERE id = ?").run(orderId);
        } else if (tindakan === 'tolak') {
            // Jika ditolak, kembalikan stok produk yang sebelumnya sudah terpotong
            const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
            const restoreStock = db.prepare('UPDATE products SET stok = stok + ? WHERE id = ?');
            
            items.forEach(item => {
                restoreStock.run(item.qty, item.product_id);
            });

            db.prepare("UPDATE orders SET status = 'ditolak' WHERE id = ?").run(orderId);
        }
        res.redirect('/admin/pesanan');
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal memperbarui status approval pesanan.');
    }
});

// 7. Tampilan Manajemen Akun Pengguna
router.get('/user', (req, res) => {
    const users = db.prepare('SELECT * FROM users WHERE role != ?').all('admin');
    res.render('admin/user', { users });
});

// 8. Logika Mengubah Status Akun User (Aktif / Nonaktif)
router.get('/user/toggle/:id', (req, res) => {
    const user = db.prepare('SELECT status FROM users WHERE id = ?').get(req.params.id);
    if (user) {
        const newStatus = user.status === 'aktif' ? 'nonaktif' : 'aktif';
        db.prepare('UPDATE users SET status = ? WHERE id = ?').run(newStatus, req.params.id);
    }
    res.redirect('/admin/user');
});

// 9. Halaman Laporan Transaksi Ringkas
router.get('/laporan', (req, res) => {
    const sales = db.prepare(`
        SELECT o.id, u.nama as nama_user, o.total, o.tanggal, o.status 
        FROM orders o 
        JOIN users u ON o.user_id = u.id 
        WHERE o.status = 'disetujui'
        ORDER BY o.tanggal DESC
    `).all();
    
    res.render('admin/laporan', { sales });
});

module.exports = router;
