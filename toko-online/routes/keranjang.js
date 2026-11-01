// routes/keranjang.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Mengambil koneksi database dari root
const { checkCustomer } = require('../middleware/auth'); // Memastikan hanya pembeli yang bisa checkout

// 1. Tampilan Halaman Ringkasan Keranjang Belanja
router.get('/', (req, res) => {
    // Inisialisasi array keranjang jika belum ada di session
    if (!req.session.cart) req.session.cart = [];
    
    // Hitung akumulasi total harga belanjaan
    let total = 0;
    req.session.cart.forEach(item => {
        total += item.harga * item.qty;
    });

    res.render('keranjang', { cart: req.session.cart, total: total });
});

// 2. Proses Tambah Produk ke Keranjang Belanja
router.post('/add/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const qty = parseInt(req.body.qty) || 1;

    // Ambil data produk langsung dari database untuk validasi stok riil
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    
    if (!product) {
        return res.status(404).send('Produk tidak ditemukan');
    }

    if (!req.session.cart) req.session.cart = [];

    // Periksa apakah produk serupa sudah terlanjur ada di dalam keranjang belanja
    const existingItem = req.session.cart.find(item => item.product_id === productId);

    if (existingItem) {
        // Jika ditambah, pastikan tidak melampaui batas stok gudang
        if (existingItem.qty + qty <= product.stok) {
            existingItem.qty += qty;
        } else {
            return res.send('<script>alert("Maaf, jumlah pembelian melebihi batas stok tersedia!"); window.history.back();</script>');
        }
    } else {
        // Jika belum ada, masukkan sebagai baris item baru
        if (qty <= product.stok) {
            req.session.cart.push({
                product_id: product.id,
                nama: product.nama,
                harga: product.harga,
                gambar: product.gambar,
                qty: qty
            });
        } else {
            return res.send('<script>alert("Maaf, stok produk tidak mencukupi!"); window.history.back();</script>');
        }
    }

    res.redirect('/keranjang');
});

// 3. Update Kuantitas Barang Langsung di Halaman Keranjang (Sangat ramah layar HP)
router.post('/update/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const newQty = parseInt(req.body.qty);
    
    const product = db.prepare('SELECT stok FROM products WHERE id = ?').get(productId);

    if (req.session.cart) {
        const item = req.session.cart.find(item => item.product_id === productId);
        if (item && newQty > 0 && newQty <= product.stok) {
            item.qty = newQty;
        } else if (item && newQty > product.stok) {
            return res.send('<script>alert("Kuantitas melebihi stok tersedia!"); window.location.href="/keranjang";</script>');
        }
    }
    res.redirect('/keranjang');
});

// 4. Menghapus Satu Item Tertentu dari Keranjang Belanja
router.get('/delete/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    if (req.session.cart) {
        req.session.cart = req.session.cart.filter(item => item.product_id !== productId);
    }
    res.redirect('/keranjang');
});

// 5. Tampilan Halaman Formulir Alamat Checkout (Wajib Login sebagai Customer)
router.get('/checkout', checkCustomer, (req, res) => {
    if (!req.session.cart || req.session.cart.length === 0) {
        return res.redirect('/keranjang');
    }

    let total = 0;
    req.session.cart.forEach(item => {
        total += item.harga * item.qty;
    });

    res.render('checkout', { cart: req.session.cart, total: total });
});

module.exports = router;
