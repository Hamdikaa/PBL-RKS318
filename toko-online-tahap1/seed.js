// Data contoh (opsional): jalankan  node seed.js
const db = require('./db');
(async () => {
  await db.siap;
  if ((await db.one('SELECT COUNT(*) AS n FROM products')).n > 0) {
    console.log('Tabel produk sudah berisi data, seed dilewati.');
  } else {
    const admin = await db.one("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    const data = [
      ['Kaos Polos Katun', 'Kaos katun adem, nyaman dipakai sehari-hari.', 59000, 40, 'Pakaian'],
      ['Tas Ransel Harian', 'Ransel muat laptop 14 inci dengan saku depan.', 189000, 15, 'Tas'],
      ['Botol Minum 750 ml', 'Botol stainless, tahan panas dan dingin.', 79000, 25, 'Peralatan'],
      ['Topi Baseball', 'Topi dengan tali belakang yang bisa diatur.', 45000, 30, 'Aksesori'],
      ['Dompet Kulit Sintetis', 'Dompet tipis dengan 6 slot kartu.', 99000, 0, 'Aksesori'],
      ['Sepatu Kets Putih', 'Sepatu kets ringan untuk santai.', 249000, 12, 'Sepatu']
    ];
    for (const p of data) {
      await db.query('INSERT INTO products (seller_id, nama, deskripsi, harga, stok, kategori) VALUES (?, ?, ?, ?, ?, ?)', [admin.id, ...p]);
    }
    console.log('6 produk contoh ditambahkan.');
  }
  process.exit(0);
})();
