// routes/produk.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Mengambil koneksi database dari root
const { checkLogin } = require('../middleware/auth'); // Pengunci rute ulasan wajib login

// 1. Tampilan Halaman Katalog Utama (Bisa dicari berdasarkan nama)
router.get('/', (req, res) => {
    const search = req.query.search || '';
    let products;

    if (search) {
        products = db.prepare('SELECT * FROM products WHERE nama LIKE ?').all(`%${search}%`);
    } else {
        products = db.prepare('SELECT * FROM products').all();
    }

    res.render('produk/katalog', { products, search });
});

// 2. Tampilan Halaman Detail Produk & List Ulasan Bintang
router.get('/detail/:id', (req, res) => {
    const productId = req.params.id;

    // Ambil data produk spesifik
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) {
        return res.status(404).send('Produk tidak ditemukan atau telah dihapus.');
    }

    // Ambil semua ulasan produk beserta nama pengulasnya menggunakan JOIN
    const reviews = db.prepare(`
        SELECT r.*, u.nama as nama_user 
        FROM reviews r 
        JOIN users u ON r.user_id = u.id 
        WHERE r.product_id = ? 
        ORDER BY r.tanggal DESC
    `).all(productId);

    // Hitung rata-rata rating bintang produk
    const avgRatingData = db.prepare('SELECT AVG(rating) as avg FROM reviews WHERE product_id = ?').get(productId);
    const avgRating = avgRatingData.avg ? Math.round(avgRatingData.avg * 10) / 10 : 0;

    res.render('produk/detail', { product, reviews, avgRating });
});

// 3. Proses Pengiriman Ulasan Baru (Wajib Login)
router.post('/detail/:id/ulasan', checkLogin, (req, res) => {
    const productId = req.params.id;
    const userId = req.session.user.id;
    const { rating, komentar } = req.body;

    try {
        const insertReview = db.prepare('INSERT INTO reviews (product_id, user_id, rating, komentar) VALUES (?, ?, ?, ?)');
        insertReview.run(productId, userId, parseInt(rating), komentar);
        
        res.redirect(`/produk/detail/${productId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Gagal mengirimkan ulasan produk.');
    }
});

module.exports = router;
