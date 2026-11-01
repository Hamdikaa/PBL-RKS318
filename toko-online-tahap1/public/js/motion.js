// Menu HP, header yang bersembunyi saat scroll, efek paralaks, dan animasi muncul saat di-scroll
(function () {
  var html = document.documentElement;
  var kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Menu layar penuh di HP
  var tombol = document.getElementById('tombolMenu');
  var menu = document.getElementById('menuUtama');
  function atur(buka) {
    menu.classList.toggle('buka', buka);
    html.classList.toggle('menu-buka', buka);
    tombol.setAttribute('aria-expanded', buka ? 'true' : 'false');
    tombol.setAttribute('aria-label', buka ? 'Tutup menu' : 'Buka menu');
  }
  if (tombol && menu) {
    tombol.addEventListener('click', function () { atur(!menu.classList.contains('buka')); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) atur(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') atur(false); });
  }

  // Header hilang saat scroll turun, muncul saat scroll naik; teks raksasa bergeser pelan
  var kepala = document.getElementById('kepala');
  var raksasa = document.getElementById('raksasa');
  var terakhir = window.scrollY;
  var menunggu = false;
  function saatScroll() {
    var y = window.scrollY;
    if (kepala && !html.classList.contains('menu-buka')) {
      if (y > 140 && y > terakhir + 4) kepala.classList.add('sembunyi');
      else if (y < terakhir - 4 || y <= 140) kepala.classList.remove('sembunyi');
    }
    if (raksasa && !kurangiGerak && y < 1200) {
      raksasa.style.transform = 'translate3d(' + (-y * 0.14) + 'px,' + (y * 0.07) + 'px,0)';
    }
    terakhir = y;
    menunggu = false;
  }
  window.addEventListener('scroll', function () {
    if (!menunggu) { menunggu = true; requestAnimationFrame(saatScroll); }
  }, { passive: true });

  // Elemen muncul bertahap saat masuk layar
  if (kurangiGerak || !('IntersectionObserver' in window)) return;
  var pilih = ['.row.g-3 > .col', '.langkah li', '.bagian-judul', '.daftar-ulasan li', '.ringkas > div',
    '.menu-admin a', '.kotak-bayar', '.ringkasan-item li', '.kartu-auth'].join(',');
  var io = new IntersectionObserver(function (daftar) {
    daftar.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('masuk'); io.unobserve(e.target); }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
  document.querySelectorAll(pilih).forEach(function (el, i) {
    el.classList.add('reveal');
    el.style.setProperty('--i', i % 6);
    io.observe(el);
  });
})();
