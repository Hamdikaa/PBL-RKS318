exports.isLogin = (req, res, next) => {
  if (req.session.user) return next();
  req.session.flash = { type: 'warning', text: 'Silakan masuk terlebih dahulu.' };
  res.redirect('/login');
};

exports.isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.status(403).render('404', { title: 'Akses ditolak' });
};

// Admin dan seller (penjual)
exports.isStaff = (req, res, next) => {
  if (req.session.user && ['admin', 'seller'].includes(req.session.user.role)) return next();
  res.status(403).render('404', { title: 'Akses ditolak' });
};

exports.guestOnly = (req, res, next) => {
  if (req.session.user) return res.redirect('/');
  next();
};
