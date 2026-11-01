// Ubah identitas toko di sini: nama, slogan, teks beranda, pengumuman.
// Simpan file, lalu muat ulang browser (server restart otomatis).
module.exports = {
  nama: 'KOPDES CAMP',
  slogan: 'Pilihan terbaik untuk setiap pendakian.',
  judul: ['Ayo', 'Muncak lek'],          // dua baris besar di beranda
  pengumuman: 'Koleksi baru telah tiba',  // bar hitam paling atas (kosongkan '' untuk menyembunyikan)
  ticker: ['Koleksi baru', 'Belanja mudah', 'Bayar lewat transfer', 'Pantau pesanan dari HP'],
  email: 'jovaniaditya05@gmail.com',                               // tampil di footer jika diisi
  jalurLogin: ['/masuk.php'],
  sampul: 'gambar-orang-daki.jpg',          // nama file di folder public/img (kosongkan '' untuk kembali ke latar hitam)
  sampulGelap: 0.8,            // 0 sampai 1: makin besar makin gelap (supaya teks putih terbaca)
};