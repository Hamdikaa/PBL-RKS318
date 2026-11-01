// routes/order.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Mengambil koneksi database dari root
const multer = require('multer');
const path = require('path');
const { checkCustomer } = require('../middleware/auth'); // Proteksi khusus pembeli

// --- Konfigurasi Penyimpanan Upload Multer ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/uploads/'); // Berkas foto disimpan di folder public/uploads
    },
    filename: (req, file, cb) => {
        // Nama file diacak menggunakan timestamp unik agar tidak bentrok
        cb(null, 'bukti-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 1. Proses Konversi Keranjang Session Menjadi Data Tabel Database (Checkout)
router.post('/checkout', checkCustomer, (req, res) => {
    const userId = req.session.user.id;
    const cart = req.session.cart;

    if (!cart || cart.length === 0) {
        return res.redirect('/produk');
    }

    // Hitung total akhir
    let total = 0;
    cart.forEach(item => { total += item.harga * item.qty; });

    // Membuka database transaksi agar proses berjalan aman (Atomic)
    const runTransaction = db.transaction(() => {
        // A. Simpan data induk pesanan ke tabel orders
        const insertOrder = db.prepare('INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)');
        const result = insertOrder.run(userId, total, 'menunggu_bayar');
        const orderId = result.lastInsertRowid;

        // B. Siapkan query untuk item pesanan dan pemotongan stok produk
        const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, qty, harga) VALUES (?, ?, ?, ?)');
        const updateStock = db.prepare('UPDATE products SET stok = stok - ? WHERE id = ?');

        // C. Iterasi barang di keranjang dan validasi sisa stok fisik terbaru
        for (const item of cart) {
            const prod = db.prepare('SELECT stok, nama FROM products WHERE id = ?').get(item.product_id);
            if (!prod || prod.stok < item.qty) {
                throw new Error(`Stok produk "${item.nama}" mendadak habis atau tidak mencukupi!`);
            }
            
            insertItem.run(orderId, item.product_id, item.qty, item.harga);
            updateStock.run(item.qty, item.product_id);
        }

        return orderId;
    });

    try {
        runTransaction();
        req.session.cart = []; // Kosongkan keranjang belanja pembeli karena checkout sukses
        res.redirect('/order/riwayat');
    } catch (error) {
        // Tampilkan pesan kegagalan jika stok tidak cukup saat detik-detik terakhir checkout
        res.send(`<script>alert("${error.message}"); window.location.href="/keranjang";</script>`);
    }
});

// 2. Tampilan Halaman Riwayat Transaksi Kepemilikan Customer
router.get('/riwayat', checkCustomer, (req, res) => {
    const userId = req.session.user.id;
    
    // Ambil daftar transaksi milik user yang sedang aktif login
    const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY tanggal DESC').all(userId);
    
    // Tarik list item barang di setiap nota menggunakan perulangan looping
    orders.forEach(order => {
        order.items = db.prepare(`
            SELECT oi.*, p.nama, p.gambar 
            FROM order_items oi 
            JOIN products p ON oi.product_id = p.id 
            WHERE oi.order_id = ?
        `).all(order.id);
    });

    res.render('riwayat', { orders });
});

// 3. Pemrosesan Upload Berkas Bukti Transfer Pembayaran
router.post('/upload-bukti/:id', checkCustomer, upload.single('bukti_bayar'), (req, res) => {
    const orderId = req.params.id;
    const filename = req.file ? req.file.filename : null;

    if (!filename) {
        return res.send('<script>alert("Gagal: Mohon lampirkan gambar kertas bukti transfer Anda!"); window.history.back();</script>');
    }

    try {
        // Perbarui status pesanan agar masuk ke antrean verifikasi admin
        db.prepare('UPDATE orders SET status = ?, bukti_bayar = ? WHERE id = ?')
          .run('menunggu_verifikasi', filename, orderId);

        res.redirect('/order/riwayat');
    } catch (err) {
        console.error(err);
        res.status(500).send('Terjadi galat internal server saat mengunggah gambar.');
    }
});

module.exports = router;
