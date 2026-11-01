// GANTI data rekening dan tarif pengiriman ini sesuai toko Anda
module.exports = {
  bank: { nama: 'BCA', rekening: '1234567890', atasNama: 'Toko Mentari' },
  kurir: [
    { kode: 'reguler', nama: 'Reguler (3-5 hari)', tarif: 15000 },
    { kode: 'kilat', nama: 'Kilat (1-2 hari)', tarif: 30000 }
  ],
  status: {
    menunggu_bayar: 'Menunggu pembayaran',
    menunggu_verifikasi: 'Menunggu verifikasi',
    disetujui: 'Disetujui (diproses)',
    dikirim: 'Dikirim',
    selesai: 'Selesai',
    ditolak: 'Bukti ditolak',
    dibatalkan: 'Dibatalkan'
  }
};
