// Unggah foto avatar (dipakai halaman daftar dan profil)
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const DIR = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: DIR,
    filename: (req, file, cb) =>
      cb(null, 'avatar-' + Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname).toLowerCase())
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp)$/.test(file.mimetype);
    cb(ok ? null : new Error('TIPE'), ok);
  }
});

exports.unggahAvatar = (req, res, next) =>
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      req.uploadError = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran foto maksimal 2 MB.'
        : err.message === 'TIPE' ? 'Foto harus berformat JPG, PNG, atau WEBP.' : 'Foto gagal diunggah.';
    }
    next();
  });

exports.hapusAvatar = (nama) => { if (nama) fs.unlink(path.join(DIR, nama), () => {}); };
