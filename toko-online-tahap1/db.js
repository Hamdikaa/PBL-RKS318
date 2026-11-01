// Koneksi MySQL/MariaDB (mysql2). Database dan tabel dibuat otomatis saat server pertama kali jalan.
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const cfg = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || ''
};
const NAMA_DB = process.env.DB_NAME || 'toko_online';

const pool = mysql.createPool({
  ...cfg, database: NAMA_DB, waitForConnections: true, connectionLimit: 10,
  dateStrings: true, decimalNumbers: true, charset: 'utf8mb4'
});

const query = async (sql, args = []) => (await pool.query(sql, args))[0];
const one = async (sql, args = []) => (await query(sql, args))[0];

// Transaksi: semua perintah berhasil, atau semuanya dibatalkan
async function tx(fn) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const hasil = await fn(async (sql, args = []) => (await c.query(sql, args))[0]);
    await c.commit();
    return hasil;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

const TABEL = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer',
    status VARCHAR(20) NOT NULL DEFAULT 'aktif',
    avatar VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    seller_id INT NULL,
    nama VARCHAR(150) NOT NULL,
    deskripsi TEXT,
    harga INT NOT NULL,
    stok INT NOT NULL DEFAULT 0,
    kategori VARCHAR(80),
    gambar VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    user_id INT NOT NULL,
    rating TINYINT NOT NULL,
    komentar TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total INT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'menunggu_bayar',
    bukti_bayar VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    qty INT NOT NULL,
    harga INT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

// Tambah kolom jika belum ada (database lama otomatis ikut diperbarui)
async function tambahKolom(tabel, kolom, definisi) {
  const ada = await query(`SHOW COLUMNS FROM \`${tabel}\` LIKE ?`, [kolom]);
  if (!ada.length) await query(`ALTER TABLE \`${tabel}\` ADD COLUMN \`${kolom}\` ${definisi}`);
}

async function mulai() {
  const sambung = await mysql.createConnection(cfg);
  await sambung.query(`CREATE DATABASE IF NOT EXISTS \`${NAMA_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await sambung.end();
  for (const sql of TABEL) await pool.query(sql);
  await tambahKolom('users', 'telepon', 'VARCHAR(30) NULL');
  await tambahKolom('users', 'alamat', 'TEXT NULL');
  await tambahKolom('orders', 'nama_penerima', 'VARCHAR(100) NULL');
  await tambahKolom('orders', 'telepon', 'VARCHAR(30) NULL');
  await tambahKolom('orders', 'alamat', 'TEXT NULL');
  await tambahKolom('orders', 'kurir', 'VARCHAR(40) NULL');
  await tambahKolom('orders', 'ongkir', 'INT NOT NULL DEFAULT 0');
  await tambahKolom('orders', 'resi', 'VARCHAR(60) NULL');
  if (!(await one("SELECT id FROM users WHERE role = 'admin' LIMIT 1"))) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    await query('INSERT INTO users (nama, email, password, role) VALUES (?, ?, ?, ?)', ['Admin', 'admin@toko.com', hash, 'admin']);
  }
}

module.exports = { pool, query, one, tx, siap: mulai() };
