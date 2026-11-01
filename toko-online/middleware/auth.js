// middleware/auth.js

// Memastikan pengunjung sudah login
function checkLogin(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
}

// Memastikan pengguna adalah Admin
function checkAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('Akses Terlarang: Halaman ini hanya untuk Administrator!');
    }
    next();
}

// Memastikan pengguna adalah Customer biasa
function checkCustomer(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'customer') {
        return res.redirect('/auth/login');
    }
    next();
}

module.exports = { checkLogin, checkAdmin, checkCustomer };
