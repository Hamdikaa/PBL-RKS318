// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db'); // Mengambil koneksi database dari root

// 1. Tampilan Halaman Register
router.get('/register', (req, res) => {
    res.render('auth/register', { error: null });
});

// 2. Logika Pemrosesan Register
router.post('/register', async (req, res) => {
    const { nama, email, password } = req.body;
    try {
        // Cek apakah email sudah terdaftar sebelumnya
        const userExist = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (userExist) {
            return res.render('auth/register', { error: 'Email sudah terdaftar! Gunakan email lain.' });
        }

        // Enkripsi password demi keamanan database
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Masukkan data pengguna baru ke database (Default role: customer)
        const insertUser = db.prepare('INSERT INTO users (nama, email, password, role, status) VALUES (?, ?, ?, ?, ?)');
        insertUser.run(nama, email, hashedPassword, 'customer', 'aktif');

        res.redirect('/auth/login');
    } catch (err) {
        console.error(err);
        res.render('auth/register', { error: 'Terjadi kegagalan sistem saat mendaftar.' });
    }
});

// 3. Tampilan Halaman Login
router.get('/login', (req, res) => {
    res.render('auth/login', { error: null });
});

// 4. Logika Pemrosesan Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        
        // Validasi keberadaan akun dan status keaktifan akun
        if (!user || user.status !== 'aktif') {
            return res.render('auth/login', { error: 'Akun tidak ditemukan atau telah dinonaktifkan.' });
        }

        // Verifikasi password hash
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.render('auth/login', { error: 'Kombinasi email atau password salah!' });
        }

        // Simpan data kredensial penting ke dalam session
        req.session.user = {
            id: user.id,
            nama: user.nama,
            email: user.email,
            role: user.role
        };

        // Redireksi halaman sesuai dengan hak akses masing-masing
        if (user.role === 'admin') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/produk');
        }
    } catch (err) {
        console.error(err);
        res.render('auth/login', { error: 'Terjadi kesalahan sistem pada server.' });
    }
});

// 5. Logika Pemrosesan Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.log(err);
        res.redirect('/');
    });
});

module.exports = router;
